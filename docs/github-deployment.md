# Retired AWS main-to-dev deployment (historical)

> Deployment change, 2026-09-14: AWS dev/prod were deleted at the owner's request. Previous AWS URLs and administrator references below are historical. Local demo data remains intact. The AWS CI deployment job has been removed and deployment scripts are disabled. See the [free public-demo proposal](free-demo-deployment.md).


Status: retired. The AWS resources and OIDC trust were deleted. The current CI
workflow runs quality checks only; production deployment uses Vercel CLI.
The remaining sections describe the former design, not an active pipeline.

The `CI` workflow runs quality checks on pull requests and branch pushes. Its
`deploy-dev` job runs only after successful quality checks for a push to `main`
(including a merged pull request). It builds one immutable ECR image named
`dev-<full-commit-sha>`, updates the existing dev CloudFormation stack, then checks
health, readiness, the displayed public credentials, login, and Socket.IO fallback.
The job records the exact commit, digest, and origin in its run summary.

No deployment runs on a pull request or `codex/**` push. Dev deployments are
serialized without cancelling an active stack operation. A superseded commit
is skipped before creating its change set. Release changes are restricted to
non-replacing updates of the App Runner Service. Other infrastructure changes
require a separate reviewed CloudFormation operation. Existing networking and
private credentials are preserved. The generated HTTPS origin is retained.

## Bootstrap before merging

1. Inspect the repository's GitHub OIDC subject format and the AWS account's
   existing OIDC provider/roles. Do not assume the subject format from the repo name.
2. Through CloudFormation, create a repository/environment-scoped GitHub OIDC
   deployment role and a separate dev CloudFormation execution role. Limit access
   to the dev stack and ECR publication; do not grant the workflow owner-password
   access or production stack control.
3. Configure the GitHub `dev` environment to permit deployments only from `main`.
   Set `DEV_AWS_ROLE_ARN` and `DEV_CFN_EXECUTION_ROLE_ARN` as environment variables.
   OIDC supplies temporary credentials; AWS access keys are not required.
4. Validate the role trust, execution policy, and workflow, then review the branch.
   Commit/push/merge only when explicitly authorized by the repository owner.
5. Merge to `main`, observe quality checks and dev deployment, and verify the
   demo login and sample data before sharing the dev link.

## Production release

The agreed strategy is a release tag selecting a tested commit from `main` and
promoting its already-verified image digest to an immutable prod tag without
rebuilding. The prod workflow and its separate authorization are still pending;
pushing a Git tag currently does not deploy prod. Keep the dev/prod databases,
secrets, and public origins separate. Database migrations must remain compatible
with any image selected for rollback.

## Bootstrap checkpoint (2026-09-14)

The verified OIDC subject is
`repo:arsahindev@80679047/incident-flow@1323148153:environment:dev`.
The dev environment has exactly one deployment policy: branch `main`.
Both role variables are configured and were read back successfully.

`infra/cloudformation/github-dev-deployment.yaml` defines the shared GitHub OIDC
provider and separate GitHub deployment/CloudFormation execution roles. The
execution role can describe/update the existing dev service and pass its two
existing runtime/ECR roles. The GitHub role can publish to the immutable ECR
repository and manage dev change sets using that execution role. It cannot
directly read secrets, delete images, or modify the prod stack.

AWS validate-template passed. Change set `bootstrap-20260914` on stack
`incidentflow-github-dev` contains exactly three Add operations and no failed
validation events. After explicit user approval, the change set was executed and the stack reached
CREATE_COMPLETE. All three resources now exist. The deployed trust policy matches
the verified subject exactly, and IAM Access Analyzer found no findings in either
identity policy. The OIDC
provider has Retain policies because it will be shared with later release roles.

Configured GitHub environment variables:

- `DEV_AWS_ROLE_ARN`: `arn:aws:iam::756649908672:role/incidentflow-github-dev-GitHubDevRole-CiPxVVgQdHO6`
- `DEV_CFN_EXECUTION_ROLE_ARN`: `arn:aws:iam::756649908672:role/incidentflow-github-dev-DevCloudFormationRole-psxGGsz3Fvyc`

These are public role identifiers, not credentials. An actual main-branch CI run
is still required to verify OIDC assumption and the complete release path.
