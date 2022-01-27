# TWItter STreaming (TWIST) Framework

The TWItter STreaming (TWIST) framework contains [Node.js](https://nodejs.org/) utilities written in
[TypeScript](https://www.typescriptlang.org/) for implementing Extract, Transform and Load (ETL)
pipelines. The framework handles streaming of Tweets from Twitter's
[PowerTrack API](https://developer.twitter.com/en/docs/twitter-api/enterprise/powertrack-api/overview),
and provides tools for sending high volumes of data to HTTP APIs for transformation and loading the
results into a database.

The framework also includes basic tools for building APIs on top of the data loaded into the
database.

## What's in the box?

The `src/` directory contains the following folders:

* **`database/`** base classes for accessing databases and tables.
* **`http/`** classes for streaming HTTP data, managing highly parallel requests and serving APIs.
* **`twitter/`** classes for streaming and searching Tweets through the Twitter API.
* **`util/`** useful helpers.

Some of these folders (e.g. `http` and `twitter`) include an `examples` subfolder with specific examples
for each package. In addition , the `src/app` direcotry includes a number of sample applications:

* [**crypto/**](src/app/crypto/README.md) a dashboard showing public conversation trends around various crypto coins.
* [**twidl/**](src/app/twidl/README.md) a downloader tool for large batches of historic Tweets.
* [**vsa/**](src/app/vsa/README.md) a Visual Search API (VSA) for searching Tweets with logos or textual
brand mentions.

## Contact us

### Issues?

Please open tickets and pull requests on Github.

### Security Issues?

Please report sensitive security issues via Twitter's bug-bounty program (https://hackerone.com/twitter)
rather than GitHub.
