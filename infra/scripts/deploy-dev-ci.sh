#!/usr/bin/env bash
set -euo pipefail

# Retired on 2026-09-14: the portfolio budget forbids this paid topology.
echo "AWS deployment retired. See docs/free-demo-deployment.md." >&2
exit 64

# Existing-environment releases only; infrastructure bootstrap is a separate,
# reviewed CloudFormation operation.
[[ "${GITHUB_ACTIONS:-}" == true && "${GITHUB_REF:-}" == refs/heads/main ]]
[[ "${GITHUB_SHA:-}" =~ ^[a-f0-9]{40}$ ]]
[[ "$(git rev-parse HEAD)" == "$GITHUB_SHA" ]]
: "${DEV_CFN_EXECUTION_ROLE_ARN:?Configure the dev CloudFormation execution role}"
export AWS_REGION=${AWS_REGION:-eu-central-1}
export AWS_PAGER=""
stack=incidentflow-dev
tag="dev-${GITHUB_SHA}"
task_dir=$(mktemp -d)
trap 'rm -rf "$task_dir"' EXIT

aws cloudformation describe-stacks --stack-name "$stack" > "$task_dir/stack.json"
origin=$(python3 - "$task_dir/stack.json" <<'PY'
import json, sys
s = json.load(open(sys.argv[1]))['Stacks'][0]
assert s['StackStatus'] in ('CREATE_COMPLETE', 'UPDATE_COMPLETE', 'UPDATE_ROLLBACK_COMPLETE')
origin = next(o['OutputValue'] for o in s['Outputs'] if o['OutputKey'] == 'ServiceUrl')
assert origin.startswith('https://')
print(origin)
PY
)
repository=$(aws cloudformation describe-stacks --stack-name incidentflow-container-registry \
  --query "Stacks[0].Outputs[?OutputKey=='RepositoryUri'].OutputValue | [0]" --output text)
[[ "$repository" != None && "$repository" == */incidentflow ]]

# Reuse an immutable commit image on reruns. Only an actual missing tag permits
# a build; permission or network errors must fail the release.
if ! aws ecr describe-images --repository-name incidentflow --image-ids "imageTag=$tag" > "$task_dir/image.json" 2> "$task_dir/image-error"; then
  if ! grep -q ImageNotFoundException "$task_dir/image-error"; then
    cat "$task_dir/image-error" >&2
    exit 1
  fi
  aws ecr get-login-password | docker login --username AWS --password-stdin "${repository%/*}"
  docker buildx build --platform linux/amd64 --push --provenance=false \
    --build-arg API_URL=http://127.0.0.1:4000 \
    --build-arg NEXT_PUBLIC_REALTIME_URL=same-origin \
    --tag "$repository:$tag" .
fi
digest=$(aws ecr describe-images --repository-name incidentflow --image-ids "imageTag=$tag" \
  --query 'imageDetails[0].imageDigest' --output text)
python3 - "$task_dir/stack.json" "$task_dir/parameters.json" "$repository:$tag" "$origin" <<'PY'
import json, sys
stack = json.load(open(sys.argv[1]))['Stacks'][0]
values = {'ImageIdentifier': sys.argv[3], 'WebOrigin': sys.argv[4]}
parameters = [dict(ParameterKey=p['ParameterKey'], **({'ParameterValue': values[p['ParameterKey']]} if p['ParameterKey'] in values else {'UsePreviousValue': True})) for p in stack['Parameters']]
with open(sys.argv[2], 'w') as f:
    json.dump(parameters, f)
PY
change_set="main-${GITHUB_RUN_ID}-${GITHUB_RUN_ATTEMPT}"
# A slower, older quality run must not roll dev back after a newer merge.
latest_main=$(git ls-remote origin refs/heads/main | cut -f1)
if [[ "$latest_main" != "$GITHUB_SHA" ]]; then
  echo "Skipping superseded main commit $GITHUB_SHA" >> "$GITHUB_STEP_SUMMARY"
  exit 0
fi
aws cloudformation create-change-set --stack-name "$stack" --change-set-name "$change_set" \
  --change-set-type UPDATE --template-body file://infra/cloudformation/app-runner-environment.yaml \
  --parameters "file://$task_dir/parameters.json" --capabilities CAPABILITY_IAM \
  --role-arn "$DEV_CFN_EXECUTION_ROLE_ARN"
aws cloudformation wait change-set-create-complete --stack-name "$stack" --change-set-name "$change_set" || true
aws cloudformation describe-change-set --stack-name "$stack" --change-set-name "$change_set" > "$task_dir/change-set.json"
decision=$(python3 - "$task_dir/change-set.json" <<'PY'
import json, sys
c = json.load(open(sys.argv[1]))
if c['Status'] == 'FAILED' and "didn't contain changes" in c.get('StatusReason', ''):
    print('unchanged')
else:
    assert c['Status'] == 'CREATE_COMPLETE', c.get('StatusReason', c['Status'])
    changes = [x['ResourceChange'] for x in c['Changes']]
    assert changes, 'Empty change set'
    assert all(x['Action'] == 'Modify' and x['LogicalResourceId'] == 'Service' and x.get('Replacement') == 'False' for x in changes), 'Infrastructure changes need separate review'
    print('deploy')
PY
)
if [[ "$decision" == deploy ]]; then
  aws cloudformation describe-events --stack-name "$stack" --change-set-name "$change_set" --filters FailedEvents=true > "$task_dir/events.json"
  python3 -c 'import json,sys; assert not json.load(open(sys.argv[1]))["OperationEvents"], "CloudFormation validation failures"' "$task_dir/events.json"
  aws cloudformation execute-change-set --stack-name "$stack" --change-set-name "$change_set"
  aws cloudformation wait stack-update-complete --stack-name "$stack"
fi

# These are deliberately public responder credentials, never owner secrets.
export SMOKE_EMAIL=demo+dev@incidentflow.demo
export SMOKE_PASSWORD=IncidentFlow-Demo-dev-2026!
export SMOKE_EXPECT_PUBLIC_DEMO=true
node infra/scripts/smoke-deployment.mjs "$origin"
printf 'Verified dev commit %s, image %s@%s, origin %s\n' "$GITHUB_SHA" "$repository" "$digest" "$origin" >> "$GITHUB_STEP_SUMMARY"
