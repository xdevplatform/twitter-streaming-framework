// Copyright 2021 Twitter, Inc.
// SPDX-License-Identifier: Apache-2.0

//
// secureserver.ts
//
// This example set up a simple HTTPS server on port 3000. In order
// to test the server run:
//
//   curl -k https://localhost:3000/
//
// Secure servers require a private key and SSL certificate. In this
// example we use self certified keys, which requires the -k flag for
// curl above. you can read more about certificates here:
//
// https://nodejs.org/api/tls.html#tlsssl-concepts
//
// Note that SSL keys and certificates are typically stored in two
// files name <name>-key.pem and <name>-cert.pem as shown in the
// link above. Here we embed self certified keys to simplify running
// this example. This is probably *not* what you want to do in real
// code.
//

import { Printer } from '../../util'
import {
  HttpRouter,
  httpRouterMethod,
  HttpRouterRequest,
  HttpRouterResponse,
  HttpServer,
  HttpServerCertificates,
} from '..'

let count = 0
const printer = new Printer(4)
setInterval(() => {
  printer.printLines(`Serving ${count} requests per second`)
  count = 0
}, 1000)

class Server extends HttpRouter {
  @httpRouterMethod('POST', /^\/echo(\/(\d{1,4}))?\/?$/)
  public echo(req: HttpRouterRequest, res: HttpRouterResponse) {
    const wait = req.params![1]
    if (wait === undefined) {
      return [200, req.body]
    }
    setTimeout(() => res.respond(200, req.body), parseInt(wait))
  }

  @httpRouterMethod('GET', '/')
  public index() {
    count++
    return [200, 'Hello, HTTPS!\n']
  }

  @httpRouterMethod('GET')
  public ping() {
    count++
    return [200, { oops: 'pong' }]
  }

  @httpRouterMethod('GET', /^\/wait\/(\d{1,4})\/?$/)
  public wait(req: HttpRouterRequest, res: HttpRouterResponse) {
    count++
    setTimeout(() => res.respond(200, 'Wait is over'), parseInt(req.params![0]))
  }
}

const certificates = new HttpServerCertificates({
  key:`
    -----BEGIN RSA PRIVATE KEY-----
    MIIEowIBAAKCAQEA9ffyOA+z+t4tROOiehd748+Z2vA3+X0U6FkdWy+trmbU4dk2
    /5opvefCjN76qxyRtDrcNfk3clMAXvXxLY13HTy4hOiS7CX/cBY4RrewWu0ezkFk
    3h6Eslc7GSirDWEQE9ar645HiSYt47KszkdnR46YURPYwZEp2/lPnL8XNmalWJCV
    m+cW5K7Sro6Dn+hAmMjl67R6V7KzjMkFtbOfhsX89mBYP/SDX7Yxwc/uWx0w+Fki
    saIw8YYMm0a5PfEBjSWXVxeVhPw5F/OF+iZN8ZhpNOMseTZyRqXnN5Ii7Qr74Srh
    YPSoqWuFqit2kejNqO77zjnjKTNe+cpR1UNXtwIDAQABAoIBAAsJtm/3nG8Mm2F1
    CayK8z9U6KWflBN5HoASx7N430VtTe5YrhQoWekwxlVGCF+3Z358CbfOWEOkH+cj
    CFCwAYFpYSptuXIpfl4MUTgzNBHQhEpjOuCQ5AmQypEldw+hpHQPdSWb++/Wq8aF
    FSYopCTc7E7vIhIFrqg1dvIkzSjeudTZAiYnQ2vvgPsvnEO3YAqUo0AkwHl/bQeN
    VOC46aqMZAPf1Y5UmW3/0ua8HTuVbHk5QMZlWGbEPe2RbR3ILeGAvruIxSyhk9yO
    PXRsYUj5uLHAAoAPXXF5hsngHxkpY9VSOv1C3LhBL6HyNf2MmDhsOZglyU6rxgB4
    2tf/FpkCgYEA/cQw0TyhVFlmdSkG7aN54ibnkkjnOr2onl95mUBZxea2hvozP8zZ
    BjCW2A9oo8z6HK6BJy1B0M8d9pUlUcHAMJ2eB/36tih2temytMbigyf2g0uvmUEP
    YLCaHBSSBKh2Y0CxzTJkqZEAh3PewiOOhhU9q66Rv+8Aifipx/FjOD0CgYEA+CIv
    SH4jPW9CtvGs45oZ9MaaZkhcjuDQ2R4iCSKW1cFOhQVUOnhRCu26vBiuJhwM9vwi
    12yD/qJOm73wbN0iIoZTDRqoWCUur3mgIXw5HGe0uoV5MIEFbOkW/9nj6vk+a/9v
    CqaypGJT2Usd95BWHxlxPwfF9FtxW+czOdJMWwMCgYB0sJqiHHczCkkK5urAq8OI
    MsuZgNyTLlMzQEPyLJ0bW5PjTXnzhIbnScCTacJ8T+1S8wuAsFbrZdIpaTvX9Hgj
    4tagZjG7QbAUxnnelvXhyaaZiVwd5MTleU/kSbE7YxvNWBpqeRnAv2S25JkyPJd1
    IJ9TKtrqn0RoLWglAOLXIQKBgCbWovQD2lw5WAXumhMeAcYQeAZeeS5b/hSd5NHt
    OhLHKRUlGmP0hSrivwHGEywf49+c4484iwiGOyuhdUp06mzg/Yrli0gQudf5f5j+
    KqpJiT5QugFfkIvViCYP4t7amGyrFKRkJz4XrewrF8uyKejAQLuO6esvjPTHoXsB
    cbYlAoGBAJ7kP4V9koRS63AudjMqZa3BL9edM8yi/T/B51eKMltbxnd7Aa6e+nKj
    djA+bw2+54DG+ygZtQ2DNdM+VeKzBd0j2Q66egKBOm39psQaMMktxsFoW+MiYc1T
    Q9XAQiN0PQ/aPPvVfmY1z9LxvUvJLtsiXVpYhlgKEyQql/b0UJeY
    -----END RSA PRIVATE KEY-----`,
  cert: `
    -----BEGIN CERTIFICATE-----
    MIIC9jCCAd4CCQDt8nzQjKCJRzANBgkqhkiG9w0BAQUFADA9MQswCQYDVQQGEwJ1
    czELMAkGA1UECAwCY2ExEjAQBgNVBAcMCXN1bm55dmFsZTENMAsGA1UECgwEYWNt
    ZTAeFw0yMTEwMDEyMTM4MzNaFw00OTAyMTUyMTM4MzNaMD0xCzAJBgNVBAYTAnVz
    MQswCQYDVQQIDAJjYTESMBAGA1UEBwwJc3Vubnl2YWxlMQ0wCwYDVQQKDARhY21l
    MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA9ffyOA+z+t4tROOiehd7
    48+Z2vA3+X0U6FkdWy+trmbU4dk2/5opvefCjN76qxyRtDrcNfk3clMAXvXxLY13
    HTy4hOiS7CX/cBY4RrewWu0ezkFk3h6Eslc7GSirDWEQE9ar645HiSYt47Kszkdn
    R46YURPYwZEp2/lPnL8XNmalWJCVm+cW5K7Sro6Dn+hAmMjl67R6V7KzjMkFtbOf
    hsX89mBYP/SDX7Yxwc/uWx0w+FkisaIw8YYMm0a5PfEBjSWXVxeVhPw5F/OF+iZN
    8ZhpNOMseTZyRqXnN5Ii7Qr74SrhYPSoqWuFqit2kejNqO77zjnjKTNe+cpR1UNX
    twIDAQABMA0GCSqGSIb3DQEBBQUAA4IBAQCnwVNmuaPKMXtIGdSzOtpONR2nHRj+
    dux5z9T0IuEB4wqeTXFPClTVt5uI0yfq0L6bXwwiBGwDJsJaQOw03fDRx/BEsTRT
    YTX7QI7ipWcLS6yNWHCj0nS1KjqWRcXPL9DikPXxZwDmh2OAiuBGDIcI0YmAB0oa
    ywYe/5ABM60poF74izNe+mLDy0+Zqs3YijltoMzWcVnEgmZO352O1olgKUxrCbdZ
    yj94ML8zyAmLMEJz9nx8Sk1wJQA7/z4ZGKHbdMtZmqvnnetY1zKS6ilb6UCIuaJ/
    EkhiKgh94g1X6McmizmQDZEOeF1572FLIMd/WFKzcAOLdjw2NDL/5Cd3
    -----END CERTIFICATE-----`,
})

new HttpServer( new Server(), { port: 3000, certificates }).start()
