// Copyright 2021 Twitter, Inc.
// SPDX-License-Identifier: Apache-2.0

import ospath from 'path'
import { assert } from '../util'
import { promises as fs } from 'fs'
import { ObjectListing, ObjectStore, isValidBucketName, isValidObjectName } from './ObjectStore'

export class FilesystemObjectStore implements ObjectStore {

  constructor(private readonly basepath: string) {
  }

  private makeFilename(bucketName: string, objectName: string): { dirname: string, filename: string } {
    assert(isValidBucketName(bucketName), `Invalid bucket name: ${bucketName}`)
    assert(isValidObjectName(objectName), `Invalid object name: ${objectName}`)
    const dirname = ospath.join(this.basepath, bucketName)
    const filename = ospath.join(dirname, objectName)
    return { dirname, filename }
  }

  public async doesObjectExist(bucketName: string, objectName: string): Promise<boolean> {
    const info = await this.getObjectInfo(bucketName, objectName)
    return info === undefined ? false : true
  }

  public async getObjectInfo(bucketName: string, objectName: string): Promise<ObjectListing | undefined> {
    try {
      const st = await fs.stat(this.makeFilename(bucketName, objectName).filename)
      return {
        bucketName,
        objectName,
        size: st.size,
        timeCreated: st.birthtimeMs,
        timeModified: st.mtimeMs,
      }
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        return
      }
      throw error
    }
  }

  public async getObject(bucketName: string, objectName: string): Promise<Buffer | undefined> {
    try {
      return await fs.readFile(this.makeFilename(bucketName, objectName).filename)
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        return
      }
      throw error
    }
  }

  public async listObjects(bucketName: string, options?: { namesOnly: boolean }): Promise<ObjectListing[] | string[]> {
    assert(isValidBucketName(bucketName), `Invalid bucket name: ${bucketName}`)
    const dirname = ospath.join(this.basepath, bucketName)
    let files
    try {
      files = await fs.readdir(dirname)
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        return []
      }
      throw error
    }
    if (options && options.namesOnly) {
      return files
    }
    return Promise.all(files.map(fn => this.getObjectInfo(bucketName, fn) as Promise<ObjectListing>))
  }

  public async putObject(bucketName: string, objectName: string, data: Buffer): Promise<void> {
    const { dirname, filename } = this.makeFilename(bucketName, objectName)
    try {
      await fs.mkdir(dirname, { mode: 0o755 })
    } catch (error: any) {
      if (error.code !== 'EEXIST') {
        throw error
      }
    }
    return fs.writeFile(filename, data)
  }
}
