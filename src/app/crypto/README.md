# Crypto Dashboard Application

This application displays a dashboard of pricing and Twitter trendsaround notable crypto coins. It contains
a streaming engine for loading Twitter data and coing prices into DynamodDB tables. It implements an API
for exposing Tweets and trends from the database and a includes a web dashboard for presenting the data.

## Prepare

Make sure you have [Node.js](https://nodejs.org/) installed.

This application uses Twitter's
[PowerTrack API](https://developer.twitter.com/en/docs/twitter-api/enterprise/powertrack-api/overview) to
stream Tweets. Configure the following environment variables with your Twitter Premium account credentials:

* `TWITTER_ACCOUNT`
* `TWITTER_EMAIL`
* `TWITTER_PASSWORD`

### Using a cloud database

This application uses the [AWS DynamodDB database](https://aws.amazon.com/dynamodb/) because it's easy to
provision and easy to use. Make sure to setup AWS credentials in your environment variables or home
directory. You may also set the environment variable `AWS_REGION` to use a region other than the
default `us-east-1`.

### Using a local database

If you don't have easy access to an AWS account, you can use run a local version of the database. You can
[download a run your own copy)[https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/DynamoDBLocal.DownloadingAndRunning.html]
but the easiest way is probably to use docker: `docker run -p 8000:8000 amazon/dynamodb-local`.

You will also need to add an environment variable `export AWS_DYNAMODB_ENDPOINT=http://localhost:8000/` or
edit config.ts directly, to point the code at the local database.

## Build

Build the application by running the following commands in the root of the project:

```bash
npm install
npm run build
```

## Setup

Run the following command in the root of the project:

```bash
node build/app/crypto --setup
```

This will create the required tables in DynamoDB and setup the required streaming rules through the
Twitter API.

## Stream

The following command will stream Tweets and coin prices into DynamoDB:

```bash
node build/app/crypto --stream
```

Let it run at least for a few minutes to get meaningful data into the database.

### Explore

First, start the API server with the following command:

```bash
node build/app/crypto --api
```

The API should now be available on `http://localhost:4000/`.

You can now get Tweets with

```
curl http://localhost:4000/tweets/bitcoin/<start>(/<end>)?
```

and trends with

```
curl http://localhost:4000/trends/bitcoin/<start>(/<end>)?
```

where `<start>` and `<end>` are UTC timestamps in on-minute resolution in the form `yyyy-mm-ddThh:mm`.
