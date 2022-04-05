// Copyright 2021 Twitter, Inc.
// SPDX-License-Identifier: Apache-2.0

import { Obj } from '../util'

export type TweetType = 'original' | 'quote' | 'reply' | 'retweet'

//
// This is a subset of the information streamed from Twitter, which we
// find convenient and sufficient for most applications.
//
export class Tweet {
  public readonly id: string
  public readonly date: Date
  public readonly media: string[]
  public readonly text: string
  public readonly type: TweetType
  public readonly user: string

  constructor(public readonly full: Obj) {
    if (typeof full.id_str !== 'string' || !/^\d{1,20}$/.test(full.id_str)) {
      throw new Error(`Invalid Tweet id: ${full.id_str}`)
    }
    this.id = full.id_str
    this.date = new Date(full.created_at)
    this.media = getMediaObjects(full).map(getMediaLink)
    this.text = full.extended_tweet ? full.extended_tweet.full_text : full.text
    this.type = getTweetType(full)
    this.user = full.user.screen_name
  }
}

function getTweetType(full: Obj): TweetType {
  if (full.in_reply_to_status_id) {
    return 'reply'
  }
  if (full.is_quote_status && !full.text.startsWith('RT')) {
    return 'quote'
  }
  if (full.retweeted_status && full.text.startsWith('RT')) {
    return 'retweet'
  }
  return 'original'
}

function getMediaObjects(full: Obj): { media_url: string }[] {
  if (full.entities.media) {
    return full.entities.media
  }
  if (full.extended_tweet && full.extended_tweet.entities.media) {
    return full.extended_tweet.entities.media
  }
  if (full.quoted_status) {
    if (full.quoted_status.entities.media) {
      return full.quoted_status.entities.media
    }
    if (full.quoted_status.extended_tweet && full.quoted_status.extended_tweet.entities.media) {
      return full.quoted_status.extended_tweet.entities.media
    }
  }
  return []
}

function getMediaLink(media: Obj): string {
  if (
    media.type !== 'video' ||
    !media.video_info ||
    !media.video_info.variants ||
    !Array.isArray(media.video_info.variants) ||
    media.video_info.variants.length === 0
  ) {
    return media.media_url
  }

  const variants = [...media.video_info.variants] as Obj[]
  variants.sort((x: Obj, y: Obj) => (x.bitrate || 0) < (y.bitrate || 0) ? 1 : -1)
  return variants[0].url
}
