// Copyright 2021 Twitter, Inc.
// SPDX-License-Identifier: Apache-2.0

import { Obj } from '../util'

export type HttpHeaders = Record<string, string>

export function httpStringifyHeaders(headers: HttpHeaders): string {
  return Object.keys(headers).map(key => `${key}: ${headers[key]}\r\n`).join('')
}

export type HttpMethod =
  | 'CONNECT'
  | 'DELETE'
  | 'GET'
  | 'HEAD'
  | 'OPTIONS'
  | 'PATCH'
  | 'POST'
  | 'PUT'
  | 'TRACE'

export interface HttpRequest {
  method: HttpMethod
  path: string
  headers?: HttpHeaders
  body?: string
}

export interface HttpResponse {
  statusCode: number
  statusText: string
  responseHeaders: HttpHeaders
  responseText: string
  responseBody?: Obj
}

export interface HttpTransaction {
  request: HttpRequest
  response: HttpResponse
}
