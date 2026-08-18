# Bedrock Knowledge Management Avatar System

An AI-powered knowledge management sample that pairs Amazon Bedrock Knowledge Bases
(retrieval-augmented generation) with a conversational AI avatar. Users ask questions
by typing or speaking, and an animated avatar answers using content retrieved from a
private knowledge base.

> **Sample / demonstration code.** This project is intended for learning and
> experimentation. Review it against your own security, compliance, and cost
> requirements before using any part of it in production.

## Features

- **Retrieval-augmented generation** over your own documents using Amazon Bedrock
  Knowledge Bases (`retrieve_and_generate`).
- **Voice and text input** — type a prompt or dictate one (transcribed with Amazon
  Transcribe).
- **Conversational AI avatar** for spoken responses via the third-party DeepBrain AI
  Studios service (see [Third-party dependencies](#third-party-dependencies)).
- **Response caching** in Amazon DynamoDB for repeated prompts.
- **Authentication** via Amazon Cognito.

## Architecture

The stack is deployed with AWS CloudFormation and uses managed services only (no VPC
or EC2 resources).

| Layer | Service |
| --- | --- |
| Frontend | Static HTML / CSS / JavaScript (`web/`) |
| Authentication | Amazon Cognito (User Pool + Hosted UI) |
| API | Amazon API Gateway (REST + HTTP APIs) invoking AWS Lambda |
| Retrieval / generation | Amazon Bedrock Knowledge Bases |
| Vector store | Amazon OpenSearch Serverless (created by the nested stack) |
| Embeddings | `amazon.titan-embed-text-v1` |
| Text generation | `amazon.nova-pro-v1:0` and `anthropic.claude-3-sonnet-20240229-v1:0` |
| Knowledge source + ingestion | Amazon S3 with event-driven ingestion into the knowledge base |
| Speech-to-text | Amazon Transcribe |
| Cache | Amazon DynamoDB (exact-match on prompt) |
| Avatar | DeepBrain AI Studios (third party) |

Uploading or removing objects in the source S3 bucket triggers a Lambda function that
starts a Bedrock knowledge base ingestion job, so the knowledge base stays in sync with
the bucket contents.

> **Region:** the sample is configured for `us-east-1`. Confirm that every service and
> Bedrock model listed above is available and enabled in your target region before
> deploying.

## Repository layout

```
.
├── README.md
├── LICENSE
├── CONTRIBUTING.md
├── CODE_OF_CONDUCT.md
├── src/
│   ├── setup.json          # Main CloudFormation template
│   ├── knowbase.json       # Nested stack: OpenSearch Serverless + Bedrock knowledge base
│   ├── lambda_function.py   # Reference Lambda source
│   ├── *.zip               # Packaged Lambda deployment artifacts
│   └── lambda_codes/*.zip  # Packaged Lambda layers / custom-resource handlers
└── web/                    # Static frontend (HTML, JS, CSS, media)
```

> **Note on the `.zip` artifacts:** the Lambda functions and layers are provided as
> pre-packaged deployment archives that the CloudFormation template pulls from the
> `SourceBucket` you supply. Inspect these archives before deploying.

## Prerequisites

- An AWS account with permission to deploy the resources listed above.
- **Amazon Bedrock model access enabled** for the Titan, Nova, and Claude models listed
  in the architecture table. See
  [Manage access to Amazon Bedrock foundation models](https://docs.aws.amazon.com/bedrock/latest/userguide/model-access.html).
- The AWS CLI or access to the CloudFormation console.
- **A DeepBrain AI Studios account and credentials** for the avatar feature — see below.

### Third-party dependencies

The avatar is powered by **DeepBrain AI Studios** (`aistudios.com` / `deepbrain.io`), a
third-party commercial service that is **not** part of AWS. To use the avatar you must:

1. Create your own DeepBrain AI Studios account and obtain an `appId`, `userKey`, and
   avatar model ID.
2. Open `web/js/demo2js.js` and replace the placeholders with your own values:
   - `__appid__`
   - `__userkey__`
   - `__ai_model_id__`

Do **not** commit real credentials. Review DeepBrain's terms of service, pricing, and
data handling separately; their use is governed by DeepBrain, not by this sample or AWS.

## Deployment

1. Create an S3 bucket for the deployment artifacts and upload the contents of `src/`
   (including the `.zip` packages and `knowbase.json`) to it.
2. Deploy `src/setup.json` with AWS CloudFormation, providing these parameters:

   | Parameter | Description | Default |
   | --- | --- | --- |
   | `InitialUserEmail` | Email for the initial Cognito user. An auto-generated password is sent here. | *(required)* |
   | `InitialUsername` | Username for the initial Cognito user. Leave blank to auto-generate. | `demo-user` |
   | `SourceBucket` | Name of the bucket holding the template and artifacts from step 1. | *(required)* |

   Example:

   ```bash
   aws cloudformation deploy \
     --template-file src/setup.json \
     --stack-name bedrock-kb-avatar \
     --capabilities CAPABILITY_NAMED_IAM \
     --parameter-overrides \
       InitialUserEmail=you@example.com \
       SourceBucket=your-artifact-bucket
   ```

3. After the stack completes, sign in through the Cognito Hosted UI with the initial
   user credentials, then open the frontend in `web/`.
4. Configure the DeepBrain placeholders in `web/js/demo2js.js` as described above.
5. Upload documents to the knowledge base source bucket to populate the knowledge base.

## Cost

Deploying this sample creates billable resources, including Amazon Bedrock model
invocations, OpenSearch Serverless capacity, Lambda, API Gateway, DynamoDB, S3, Cognito,
and Amazon Transcribe usage. OpenSearch Serverless in particular has an ongoing minimum
cost. The DeepBrain AI Studios avatar is billed separately by DeepBrain. Review the
pricing pages for each service and monitor your usage.

## Cleanup

To avoid ongoing charges, delete the CloudFormation stack when you are finished:

```bash
aws cloudformation delete-stack --stack-name bedrock-kb-avatar
```

Then empty and delete the artifact bucket and the knowledge base source bucket, and
confirm the nested OpenSearch Serverless collection has been removed.

## Security

- This is sample code; validate it against your own security requirements before use.
- Never commit real credentials. The DeepBrain values in `web/js/demo2js.js` are
  placeholders.
- The frontend is a static demo; add appropriate authorization and hardening before any
  production use.
- Report security issues per the guidance in the repository `CONTRIBUTING` file rather
  than opening a public issue.

## License

Licensed under the MIT-0 License. See the `LICENSE` file at the root of this repository.
