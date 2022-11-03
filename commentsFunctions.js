const AWS = require('aws-sdk');
const dynamo = new AWS.DynamoDB.DocumentClient();

const commentsTableName = process.env.COMMENTS_TABLE_NAME;
const region = process.env.REGION;

AWS.config.update({ region });

exports.handler = async (event, context) => {
  console.log('event log: ', event);
  let body;
  let statusCode = 200;
  let headers = {
    'Content-Type': 'application/json',
  };

  try {
    switch (event.routeKey) {
      //post comment
      case 'PUT /comment':
        const requestJSONPost = JSON.parse(event.body);

        await dynamo
          .put(
            {
              TableName: commentsTableName,
              Item: {
                id: requestJSONPost.id,
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

      //update comment by ID
      case 'PUT /comment/{id}':
        const requestJSONPut = JSON.parse(event.body);

        const paramsPut = {
          Key: {
            id: event.pathParameters.id,
          },
          ExpressionAttributeNames: {
            '#userId': 'userId',
            '#videoId': 'videoId',
            '#comment': 'comment',
            '#timeStamp': 'timeStamp',
          },
          ExpressionAttributeValues: {
            ':userId': requestJSONPut.userId,
            ':videoId': requestJSONPut.videoId,
            ':comment': requestJSONPut.comment,
            ':timeStamp': requestJSONPut.timeStamp,
          },
          UpdateExpression:
            'SET #userId = :userId, #videoId = :videoId, #comment = :comment, #timeStamp = :timeStamp',
          TableName: commentsTableName,
        };
        await dynamo
          .update(paramsPut, (err, data) => {
            if (err) {
              console.log(err);
            } else {
              console.log(data);
            }
          })
          .promise();

        body = {
          message: `Comment ID ${paramsPut.Key.id} edited on DynamoDB.`,
        };
        break;

      case 'DELETE /comment/{id}':
        const params = {
          Key: {
            id: event.pathParameters.id,
          },
          TableName: commentsTableName,
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
      case 'GET /comments/{videoId}':
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
        const deleteDDBCommentsParams = {
          TableName: commentsTableName,
          IndexName: 'videoId-timeStamp-index',
          ExpressionAttributeValues: {
            ':videoId': event.pathParameters.videoId,
          },
          KeyConditionExpression: 'videoId = :videoId',
        };

        const data = await dynamo
          .query(deleteDDBCommentsParams, (err, data) => {
            if (err) {
              console.log('err: ', err);
            } else {
              console.log('success. Comments to delete: ', data);
            }
          })
          .promise();

        const itemsToDelete = data.Items;

        let deleteArray = [];
        let itemsLeft = itemsToDelete.length;
        let deleteArrayNumber = 0;

        for (const i of itemsToDelete) {
          deleteArray.push({ DeleteRequest: { Key: { id: i.id } } });
          itemsLeft--;

          if (deleteArray.length === 25 || itemsLeft === 0) {
            deleteArrayNumber++;

            let RequestItems = {};
            RequestItems[commentsTableName] = deleteArray;

            await dynamo
              .batchWrite({ RequestItems }, (err, data) => {
                if (err) {
                  console.log('err: ', err);
                } else {
                  console.log('success: ', data);
                }
              })
              .promise();

            console.log(
              `Batch ${deleteArrayNumber} deleted. Left items: ${itemsLeft}.`
            );
            deleteArray = []; //reset array
          }
        }
        body = {
          message: `Deleted all comments from video ${event.pathParameters.videoId}`,
        };
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
