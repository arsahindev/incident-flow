#!/usr/bin/env bash
set -euo pipefail

# Retired on 2026-09-14: the portfolio budget forbids this paid topology.
echo "AWS deployment retired. See docs/free-demo-deployment.md." >&2
exit 64

if [[ $# -ne 1 || ("$1" != "dev" && "$1" != "prod") ]]; then
  echo "Usage: $0 <dev|prod>" >&2
  exit 64
fi

environment_name=$1
region=${AWS_REGION:-eu-central-1}
repository_stack=incidentflow-container-registry
environment_stack="incidentflow-${environment_name}"
git_revision=$(git rev-parse --short=12 HEAD)
# A Git-only tag can silently reuse an old image for an uncommitted fix.
source_hash=$(git ls-files --cached --others --exclude-standard -z \
  | xargs -0 shasum -a 256 | shasum -a 256 | cut -c1-12)
image_tag="${environment_name}-${git_revision}-${source_hash}"

aws --region "$region" cloudformation deploy \
  --stack-name "$repository_stack" \
  --template-file infra/cloudformation/container-registry.yaml \
  --no-fail-on-empty-changeset

repository_uri=$(aws --region "$region" cloudformation describe-stacks \
  --stack-name "$repository_stack" \
  --query "Stacks[0].Outputs[?OutputKey=='RepositoryUri'].OutputValue" \
  --output text)

if aws --region "$region" ecr describe-images \
  --repository-name "${repository_uri##*/}" \
  --image-ids "imageTag=${image_tag}" >/dev/null 2>&1; then
  echo "Reusing existing immutable image: ${repository_uri}:${image_tag}"
else
  aws --region "$region" ecr get-login-password \
    | docker login --username AWS --password-stdin "${repository_uri%/*}"

  docker buildx build --platform linux/amd64 --push \
    --build-arg API_URL=http://127.0.0.1:4000 \
    --build-arg NEXT_PUBLIC_REALTIME_URL=same-origin \
    --tag "${repository_uri}:${image_tag}" \
    .
fi

vpc_id=$(aws --region "$region" ec2 describe-vpcs \
  --filters Name=isDefault,Values=true \
  --query 'Vpcs[0].VpcId' \
  --output text)
if [[ -z "$vpc_id" || "$vpc_id" == "None" ]]; then
  echo "No default VPC was found in ${region}; pass a VPC explicitly or create one first." >&2
  exit 1
fi

subnet_ids=$(aws --region "$region" ec2 describe-subnets \
  --filters "Name=vpc-id,Values=${vpc_id}" \
  --query 'Subnets[].SubnetId' \
  --output text \
  | tr '\t' ',')
if [[ -z "$subnet_ids" || "$subnet_ids" == "None" ]]; then
  echo "No subnets were found in default VPC ${vpc_id}." >&2
  exit 1
fi

deploy_environment() {
  local web_origin=$1
  aws --region "$region" cloudformation deploy \
    --stack-name "$environment_stack" \
    --template-file infra/cloudformation/app-runner-environment.yaml \
    --capabilities CAPABILITY_NAMED_IAM \
    --parameter-overrides \
      "EnvironmentName=${environment_name}" \
      "ImageIdentifier=${repository_uri}:${image_tag}" \
      "WebOrigin=${web_origin}" \
      "VpcId=${vpc_id}" \
      "SubnetIds=${subnet_ids}" \
      "SeedOwnerEmail=owner+${environment_name}@incidentflow.demo" \
    --no-fail-on-empty-changeset
}

# The first deployment creates the App Runner hostname. The explicit
# `same-origin` browser configuration avoids rebuilding after that URL is known;
# only the API's strict trusted-origin value is updated in the second pass.
existing_origin=$(aws --region "$region" cloudformation describe-stacks \
  --stack-name "$environment_stack" \
  --query "Stacks[0].Outputs[?OutputKey=='ServiceUrl'].OutputValue" \
  --output text 2>/dev/null || true)
deploy_environment "${existing_origin:-https://placeholder.invalid}"
service_url=$(aws --region "$region" cloudformation describe-stacks \
  --stack-name "$environment_stack" \
  --query "Stacks[0].Outputs[?OutputKey=='ServiceUrl'].OutputValue" \
  --output text)
deploy_environment "$service_url"

aws --region "$region" cloudformation describe-stacks \
  --stack-name "$environment_stack" \
  --query 'Stacks[0].Outputs[].[OutputKey,OutputValue]' \
  --output table
