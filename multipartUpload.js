const AWS = require('aws-sdk');
const s3 = new AWS.S3({ signatureVersion: 'v4' });

const region = process.env.REGION;
const bucketName = process.env.BUCKET_NAME;

AWS.config.update({ region });

exports.handler = async (event) => {
  let body;
  let statusCode = 200;
  let headers = {
    'Content-Type': 'application/json',
  };

  try {
    switch (event.routeKey) {
      case 'GET /start-upload':
        const startQuery = event.queryStringParameters;

        const createMultiParams = {
          Bucket: bucketName,
          Key: startQuery.key,
          ContentType: 'video/mp4',
        };

        const result = await s3
          .createMultipartUpload(createMultiParams, (err, data) => {
            if (err) {
              console.log('err: ', err);
            } else {
              console.log('data: ', data);
            }
          })
          .promise();

        body = {
          message: {
            result,
          },
        };

        break;

      case 'GET /get-upload-url':
        const uploadUrlQuery = event.queryStringParameters;
        const bucket = bucketName;

        const getSignedUrlParams = {
          Bucket: bucket,
          Key: uploadUrlQuery.key,
          PartNumber: uploadUrlQuery.partNumber,
          UploadId: uploadUrlQuery.uploadId,
        };

        const presignedURL = s3.getSignedUrl('uploadPart', getSignedUrlParams);
        return presignedURL;

      case 'POST /complete-upload':
        console.log('complete event: ', event);
        const JSONRequest = JSON.parse(event.body);

        const completeUploadParams = {
          Bucket: bucketName,
          Key: JSONRequest.key,
          MultipartUpload: {
            Parts: JSONRequest.parts,
          },
          UploadId: JSONRequest.uploadId,
        };
        const completeUpload = s3
          .completeMultipartUpload(completeUploadParams)
          .promise();
        return completeUpload;

      case 'DELETE /abort-upload':
        console.log('delete event: ', event);

        const JSONRequestAbort = JSON.parse(event.body);

        const abortParams = {
          Bucket: bucketName,
          Key: JSONRequestAbort.key,
          UploadId: JSONRequestAbort.uploadId,
        };

        const abortResult = s3
          .abortMultipartUpload(abortParams, (err, data) => {
            if (err) {
              console.log('err: ', err);
            } else {
              console.log('success: ', data);
            }
          })
          .promise();

        body = {
          message: `Abort Result: ${abortResult}`,
        };
    }
  } catch (err) {
    statusCode = 400;
    body = err.message;
  } finally {
    body = JSON.stringify(body);
  }

  return {
    statusCode,
    body,
    headers,
  };
};
