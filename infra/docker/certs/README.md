# RDS trust bundle

`eu-central-1-bundle.pem` is the public Amazon RDS regional CA bundle downloaded
on 2026-09-11 from:
https://truststore.pki.rds.amazonaws.com/eu-central-1/eu-central-1-bundle.pem

SHA-256: `56a0cae044b6cc433971d964347401692a92ea0294e392753a3ebdaee54d8b84`.

It contains the RSA2048, RSA4096, and ECC384 G1 RDS roots for eu-central-1.
It is public trust material, not a credential. Bundle it at build time because
App Runner's VPC egress does not provide internet access in this deployment.

The startup script uses `verify-full` and `sslrootcert` for node-postgres
(seed/API), and `require` and `sslaccept=strict` with OpenSSL `SSL_CERT_FILE` for Prisma
Migrate's schema engine. Never disable certificate verification to fix trust.
Review the official bundle when AWS rotates CAs, replace it deliberately, update
this checksum, rebuild, and verify both environments before retiring old roots.

Reference: https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/UsingWithRDS.SSL.html
