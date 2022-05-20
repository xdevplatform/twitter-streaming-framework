import {Converseon, ConverseonSentiment} from "./converseon";
import {getLatestCoinToUSDRate} from "./coins";
import * as config from "./config";
import {StreamedTweet} from "../../twitter";

export type TweetStored = {
    id: string;
    followers_count: number;
}

export type TwitterRank = {
    score: string
    scoreByFollowers: string
    sentiment: {
        positive: number
        neutral: number
        negative: number
        unknown: number
    }
    sentimentByFollowers: {
        positive: number
        neutral: number
        negative: number
        unknown: number
        totalFollowers: number
    }
}

export const FIVE_MIN_MS = 1000 * 60 * 5
export const ONE_WEEK_MS = 1000 * 60 * 60 * 24 * 7 + FIVE_MIN_MS
export const ONE_HOUR_MS = 1000 * 60 * 60

export const scoreOptions = ['positive', 'neutral', 'negative', 'unknown']

const converseon = new Converseon(config.CONVERSEON_API_KEY)

export function computeTwitterRank(tweets: Array<TweetStored>, sentiments: Array<ConverseonSentiment>): TwitterRank {
    const defaultValue = {sentiment: {positive: 0, neutral: 0, negative: 0, unknown: 0}, sentimentByFollowers: {positive: 0, neutral: 0, negative: 0, unknown: 0, totalFollowers: 0}}
    if (!tweets || tweets.length === 0) {
        return {score: 'unknown', scoreByFollowers: 'unknown', ...defaultValue}
    }
    const ranks = tweets.reduce(({sentiment, sentimentByFollowers}, {followers_count}, idx) => {

        const tweetSentiment = sentiments[idx]
        const value = tweetSentiment?.value || 'unknown'

        return {
            sentiment:{
                ...sentiment,
                [value]: sentiment[value] + 1,
            },
            sentimentByFollowers: {
                ...sentimentByFollowers,
                [value]: sentimentByFollowers[value] + followers_count,
                totalFollowers: sentimentByFollowers.totalFollowers + followers_count,
            }
        }
    }, defaultValue)

    // @ts-ignore
    const maxRank = (rankType: 'sentiment' | 'sentimentByFollowers') => (max: string, v: string) => ranks[rankType][max] > ranks[rankType][v] ? max : v
    const score = scoreOptions.reduce(maxRank('sentiment'))
    const scoreByFollowers = scoreOptions.reduce(maxRank('sentimentByFollowers'))

    return {
        ...ranks,
        score,
        scoreByFollowers
    }
}

export async function getDataToStore(streamedTweets: StreamedTweet[], coin = 'bitcoin') {
    const timeMs = new Date().getTime();
    const [usdRate, sentiments] = await Promise.all([
        getLatestCoinToUSDRate(coin),
        converseon.sentiment(streamedTweets.map(tweet => tweet.text)),
    ])
    const tweets = streamedTweets.map(({id, full: {user: {followers_count}}}, idx) => ({id, followers_count}))
    const tweetIds = tweets.sort(
        (a, b) => b.followers_count - a.followers_count)
        .map(({id}) => id)
    const twitterRank = computeTwitterRank(tweets, sentiments)
    return { timeMs, coin, ...twitterRank, tweetIds, usdRate }
}

export function getDatapointFrequency(startTimestamp: number, endTimestamp: number) {
    const diff = endTimestamp - startTimestamp;
    if (diff <= ONE_HOUR_MS) {
        return 1
    } else if (diff <= ONE_HOUR_MS * 2 + FIVE_MIN_MS) {
        return 2
    } else if (diff <= ONE_HOUR_MS * 4 + FIVE_MIN_MS) {
        return 5
    } else if (diff <= ONE_HOUR_MS * 24 + FIVE_MIN_MS) {
        return 10
    } else if (diff <= ONE_HOUR_MS * 24 * 2 + FIVE_MIN_MS) {
        return 15
    } else {
        return 30
    }
}