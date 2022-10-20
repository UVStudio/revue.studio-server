const AWS = require('aws-sdk');
const s3 = new AWS.S3();
const dynamo = new AWS.DynamoDB.DocumentClient();

const tableName = process.env.TABLE_NAME;
const region = process.env.REGION;
const bucketName = process.env.BUCKET_NAME;

AWS.config.update({ region });

exports.handler = async (event, context) => {
  let body;
  let statusCode = 200;
  let headers = {
    'Content-Type': 'application/json',
  };

  try {
    switch (event.routeKey) {
      case 'POST /videos/{projectId}': //get PresignedURL
        const keyObject = JSON.parse(event.body);

        const bucket = bucketName;
        const key = keyObject.upload.key;
        const signedUrlExpireSeconds = 60 * 5;

        const presignedURL = s3.getSignedUrl('putObject', {
          Bucket: bucket,
          Key: key,
          Expires: signedUrlExpireSeconds,
          ContentType: 'video/mp4',
          ACL: 'public-read',
        });

        console.log('presignedURL: ', presignedURL);
        body = {
          message: 'PresignedUrl returned',
        };
        return presignedURL;

      case 'DELETE /video/{id}':
        const requestJSON = JSON.parse(event.body);
        const s3Url = requestJSON.s3Url;

        const params = {
          Bucket: bucketName,
          Key: s3Url,
        };

        await s3
          .deleteObject(params, (err, data) => {
            if (err) {
              console.log('error: ', err);
            } else {
              console.log('success: ', data);
            }
          })
          .promise();

        body = `Deleted video ${event.pathParameters.id}`;
        break;

      case 'GET /videos/{projectId}':
        const getVideosByProjectIdParams = {
          TableName: tableName,
          IndexName: 'projectId-timeStamp-index',
          ExpressionAttributeValues: {
            ':projectId': event.pathParameters.projectId,
          },
          KeyConditionExpression: 'projectId = :projectId',
        };

        body = await dynamo
          .query(getVideosByProjectIdParams, (err, data) => {
            if (err) {
              console.log('err: ', err);
            } else {
              console.log('success: ', data);
            }
          })
          .promise();
        break;

      //GET VIDEO BY ID
      case 'GET /video/{id}':
        body = await dynamo
          .get(
            {
              TableName: tableName,
              Key: {
                id: event.pathParameters.id,
              },
            },
            (err, data) => {
              if (err) {
                console.log('err: ', err);
              } else {
                console.log('data: ', data);
              }
            }
          )
          .promise();
        break;

      case 'DELETE /videos/{projectId}':
        await dynamo
          .batchWriteItem(
            {
              TableName: tableName,
              Key: {
                projectId: event.pathParameters.projectId,
              },
            },
            (err, data) => {
              if (err) {
                console.log('err: ', err);
              } else {
                console.log('success: ', data);
              }
            }
          )
          .promise();
        body = `Deleted all videos from project ${event.pathParameters.projectId}`;
        break;

      default:
        throw new Error(`Unsupported route: "${event.routeKey}"`);
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
