const AWS = require('aws-sdk');
const dynamo = new AWS.DynamoDB.DocumentClient();

const commentsTableName = process.env.COMMENTS_TABLE_NAME;
const videosTableName = process.env.VIDEOS_TABLE_NAME;
const region = process.env.REGION;

AWS.config.update({ region });

exports.handler = async (event, context) => {
  let body;
  let statusCode = 200;
  let headers = {
    'Content-Type': 'application/json',
  };

  try {
    switch (event.routeKey) {
      case 'POST /comment/{videoId}':
        const requestJSONPost = JSON.parse(event.body);

        await dynamo
          .post(
            {
              TableName: videosTableName,
              Item: {
                id: requestJSONPost.commentId,
                userId: requestJSONPost.userId,
                videoId: requestJSONPost.videoId,
                comment: requestJSONPost.comment,
                timeStamp: requestJSONPost.timeStamp,
              },
            },
            (err, data) => {
              if (err) {
                console.log('Error', err);
              } else {
                console.log('Success', data);
              }
            }
          )
          .promise();

        body = {
          message: `New comment for video ID ${requestJSONPost.videoId} posted on DynamoDB.`,
        };
        break;

      case 'PUT /comment/{id}':
        const requestJSONPut = JSON.parse(event.body);

        await dynamo
          .put(
            {
              TableName: videosTableName,
              Item: {
                id: requestJSONPut.commentId,
                userId: requestJSONPut.userId,
                videoId: requestJSONPut.videoId,
                comment: requestJSONPut.comment,
                timeStamp: requestJSONPut.timeStamp,
              },
            },
            (err, data) => {
              if (err) {
                console.log('Error', err);
              } else {
                console.log('Success', data);
              }
            }
          )
          .promise();

        body = {
          message: `Comment ID ${requestJSONPut.commentId} edited on DynamoDB.`,
        };
        break;

      case 'DELETE /comment/{id}':
        const params = {
          Key: {
            id: event.pathParameters.id,
          },
          TableName: videosTableName,
        };

        await dynamo
          .delete(params, (err, data) => {
            if (err) {
              console.log('err: ', err);
            } else {
              console.log('success: ', data);
            }
          })
          .promise();

        body = {
          message: `Comment for comment ID ${params.Key.id} removed from DynamoDB.`,
        };
        break;

      //GET ALL COMMENTS BY VIDEO ID
      case 'GET /comments/{id}':
        const getCommentsByVideoIdParams = {
          TableName: commentsTableName,
          IndexName: 'videoId-timeStamp-index',
          ExpressionAttributeValues: {
            ':videoId': event.pathParameters.videoId,
          },
          KeyConditionExpression: 'videoId = :videoId',
        };

        body = await dynamo
          .query(getCommentsByVideoIdParams, (err, data) => {
            if (err) {
              console.log('err: ', err);
            } else {
              console.log('success: ', data);
            }
          })
          .promise();
        break;

      //GET SINGLE COMMENT BY ID
      case 'GET /comment/{id}':
        body = await dynamo
          .get(
            {
              TableName: commentsTableName,
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

      //DELETE ALL COMMENTS UNDER A SINGLE VIDEO
      case 'DELETE /comments/{videoId}':
        await dynamo
          .batchWriteItem(
            {
              TableName: commentsTableName,
              Key: {
                projectId: event.pathParameters.videoId,
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
        body = `Deleted all comments from video ${event.pathParameters.videoId}`;
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
