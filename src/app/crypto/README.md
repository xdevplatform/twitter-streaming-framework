# Crypto Dashboard Application

This application displays a dashboard of pricing and Twitter trendsaround notable crypto coins. It contains
a streaming engine for loading Twitter data and coing prices into an opbject store. It implements an API
for exposing Tweets and trends from the object store.

The app currently uses a filesystem based object store, configured by default to create a directory named
`crypto` inside the current directory and put object files in there. You can change these settings and others
in the app's configuration file `config.ts`.

## Prepare

Make sure you have [Node.js](https://nodejs.org/) installed.

This application uses Twitter's
[PowerTrack API](https://developer.twitter.com/en/docs/twitter-api/enterprise/powertrack-api/overview) to
stream Tweets. Configure the following environment variables with your Twitter Enterprise account credentials:

* `TWITTER_ACCOUNT`
* `TWITTER_EMAIL`
* `TWITTER_PASSWORD`

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

This will configure the required streaming rules through the Twitter API.

## Stream

The following command will stream Tweets and coin prices into the object store:

```bash
node build/app/crypto --stream
```

Let it run at least for a few minutes to load meaningful.

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
