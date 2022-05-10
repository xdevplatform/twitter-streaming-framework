// Copyright 2021 Twitter, Inc.
// SPDX-License-Identifier: Apache-2.0

export interface ObjectListing {
  bucketName: string
  objectName: string
  size: number
  timeCreated: number
  timeModified: number
}

export interface ObjectStore {
  doesObjectExist(bucketName: string, objectName: string): Promise<boolean>
  getObjectInfo(bucketName: string, objectName: string): Promise<ObjectListing | undefined>
  getObject(bucketName: string, objectName: string): Promise<Buffer | undefined>
  listObjects(bucketName: string, options?: { namesOnly: boolean }): Promise<ObjectListing[] | string[]>
  putObject(bucketName: string, objectName: string, data: Buffer): Promise<void>
}

function isValidName(name: string): boolean {
  return typeof name === 'string' && /^[.\w\-\:\_\$]+$/.test(name)
}

export function isValidBucketName(bucketName: string): boolean {
  return isValidName(bucketName)
}

export function isValidObjectName(objectName: string): boolean {
  return isValidName(objectName)
}
