# Twidl: A Tweet Downloader Application

Tweets go back to [March 21 2006](https://twitter.com/jack/status/20). In many cases it can be useful to
searche of past Tweets that match cetrain
[search queries](https://developer.twitter.com/en/docs/twitter-api/enterprise/search-api/guides/operators),
and in some cases results can include tens or even hundreds of thousdands of Tweets.

This Tweet Downloader (**twidl**) application is designed to run such large batch downloads. It first connects
the the Twitter API to get a count estimating the number of Tweets that match a cetrain search quesry over the
specified time range, then proceeds to download the Tweets.

The application includes mechanisms for reconnecting to the API in case of network disconnects of if the download
hits the API's rate limits. It also tracks the progress of the download and continuously displays the time of the
last Tweet downloaded successfully. This timestamp can be used to restart the download in case the application
itself fails.

## Prepare

Make sure you have [Node.js](https://nodejs.org/) installed.

This application uses Twitter's
[Search API](https://developer.twitter.com/en/docs/twitter-api/enterprise/search-api/overview) to
download Tweets. Configure the following environment variables with your Twitter Enterprise account credentials:

* `TWITTER_ACCOUNT`
* `TWITTER_EMAIL`
* `TWITTER_PASSWORD`

You can also configure the `TWITTER_LABEL` variable if you don't want to use the standard `prod` label.

## Build

Build the application by running the following commands in the root of the project:

```bash
npm install
npm run build
```

## Download

Run **twidl** using the following command:

```bash
node build/app/twidl
```

It will display a detailed help message with the required and optional command line arguments.

As an example, the following command will download Tweets containing the term "web3" from the first hour of 2022:

```bash
node build/app/twidl --query web3 --start 2022-01-01T00:00:00Z --end 2022-01-02T00:00:00Z --csv ./tweets.csv
```

This query matches slightly over 100,000 Tweets.

Add the `--count` option to your command, if you only want to get the number of matches without actually downloading
any data.

### Customize your results

The API returns a lot of
[information](https://developer.twitter.com/en/docs/twitter-api/enterprise/data-dictionary/native-enriched-objects/tweet)
per Tweet. Currently the application saves out a small subset of this information. You can edit the function
`transformTweet` in [index.ts](index.ts) to add or change the data twitten out by the downloader.
