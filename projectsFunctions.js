const AWS = require('aws-sdk');
const dynamo = new AWS.DynamoDB.DocumentClient();
const s3 = new AWS.S3({ apiVersion: '2006-03-01' });

const bucketName = process.env.BUCKET_NAME;
const projectsTableName = process.env.PROJECTS_TABLE_NAME;
const videosTableName = process.env.VIDEOS_TABLE_NAME;
const region = process.env.REGION;
AWS.config.update({ region });

exports.handler = async (event, context) => {
  let body;
  let statusCode = 200;
  const headers = {
    'Content-Type': 'application/json',
  };
  console.log('event: ', event);

  try {
    switch (event.routeKey) {
      case 'DELETE /project/{id}':
        // DELETE project by project ID
        // Cascade delete all objects in S3 by S3 Path, and row in DDB Projects Table

        // delete project table row
        const deleteDDBProjectParams = {
          TableName: projectsTableName,
          Key: {
            id: event.pathParameters.id,
          },
        };

        await dynamo
          .delete(deleteDDBProjectParams, (err, data) => {
            if (err) {
              console.log('err: ', err);
            } else {
              console.log('success: ', data);
            }
          })
          .promise();

        // delete videos table row(s) - no need to do this as S3 triggers DDB to remove rows
        // through lambda function: s3DynamoRemove

        // const deleteDDBVideosParams = {
        //   TableName: videosTableName,
        //   IndexName: 'projectId-timeStamp-index',
        //   ExpressionAttributeValues: {
        //     ':projectId': event.pathParameters.id,
        //   },
        //   KeyConditionExpression: 'projectId = :projectId',
        // };

        // const data = await dynamo
        //   .query(deleteDDBVideosParams, (err, data) => {
        //     if (err) {
        //       console.log('err: ', err);
        //     } else {
        //       console.log('success: ', data);
        //     }
        //   })
        //   .promise();

        // const itemsToDelete = data.Items;

        // let deleteArray = [];
        // let itemsLeft = itemsToDelete.length;
        // let deleteArrayNumber = 0;

        // for (const i of itemsToDelete) {
        //   deleteArray.push({ DeleteRequest: { Key: { id: i.id } } });
        //   itemsLeft--;

        //   if (deleteArray.length === 25 || itemsLeft < 0) {
        //     deleteArrayNumber++;
        //     console.log(`Batch ${deleteArrayNumber} to be deleted.`);

        //     let RequestItems = {};
        //     RequestItems[videosTableName] = deleteArray;

        //     await dynamo
        //       .batchWrite({ RequestItems }, (err, data) => {
        //         if (err) {
        //           console.log('err: ', err);
        //         } else {
        //           console.log('success: ', data);
        //         }
        //       })
        //       .promise();

        //     console.log(
        //       `Batch ${deleteArrayNumber} deleted. Left items: ${itemsLeft}.`
        //     );
        //     deleteArray = []; //reset array
        //   }
        // }

        // remove all objects from S3 URL
        const s3EmptyFolder = async () => {
          const requestJSONDelete = JSON.parse(event.body);
          const s3FolderUrl = requestJSONDelete.s3FolderUrl;

          const listS3Params = {
            Bucket: bucketName,
            Prefix: s3FolderUrl,
          };

          const listedObjects = await s3.listObjectsV2(listS3Params).promise();

          if (listedObjects.Contents.length === 0) return;

          console.log('listedObjects: ', listedObjects);

          const deleteS3Params = {
            Bucket: bucketName,
            Delete: { Objects: [] },
          };

          listedObjects.Contents.forEach((content) => {
            deleteS3Params.Delete.Objects.push({ Key: content.Key });
          });

          await s3.deleteObjects(deleteS3Params).promise();

          if (listedObjects.IsTruncated) await s3EmptyFolder();
        };

        await s3EmptyFolder();
        body = `Deleted project ${event.pathParameters.id}`;

        break;

      case 'GET /project/{id}':
        // GET project by project ID
        const getProjectByIdParams = {
          TableName: projectsTableName,
          Key: {
            id: event.pathParameters.id,
          },
        };

        body = await dynamo
          .get(getProjectByIdParams, (err, data) => {
            if (err) {
              console.log('Error', err);
            } else {
              console.log('Success', data);
            }
          })
          .promise();

        break;

      case 'GET /projects':
        //GET all projects in DDB Projects Table
        body = await dynamo.scan({ TableName: projectsTableName }).promise();

        break;

      case 'GET /projects/{userId}':
        //GET all projects by User ID
        const queryProjectsByUserIdParams = {
          IndexName: 'userId-timeStamp-index',
          ExpressionAttributeValues: {
            ':userId': event.pathParameters.userId,
          },
          KeyConditionExpression: 'userId = :userId',
          TableName: projectsTableName,
        };

        body = await dynamo
          .query(queryProjectsByUserIdParams, (err, data) => {
            if (err) {
              console.log('Error', err);
            } else {
              console.log('Success', data.Items);
            }
          })
          .promise();

        break;

      case 'POST /projects':
        //CREATE project

        //Create row in DDB and path in S3
        const requestJSONPost = JSON.parse(event.body);

        await dynamo
          .put(
            {
              TableName: projectsTableName,
              Item: {
                id: requestJSONPost.projectId,
                userId: requestJSONPost.userId,
                projectName: requestJSONPost.projectName,
                projectDescription: requestJSONPost.projectDescription,
                timeStamp: requestJSONPost.timeStamp,
                projectPassword: requestJSONPost.projectPassword,
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

        const bucketParams = {
          Bucket: `revue-studio-users`,
          Key: `${requestJSONPost.userId}/${requestJSONPost.projectId}/`,
        };

        await s3
          .putObject(bucketParams, (err, data) => {
            if (err) {
              console.log('Error', err);
            } else {
              console.log('Success', data);
            }
          })
          .promise();

        body = `Post project ${requestJSONPost.projectId}`;

        break;

      default:
        throw new Error(`Unsupported route: "${event.routeKey}"`);
    }
  } catch (err) {
    statusCode = 400;
    body = err;
  } finally {
    body = JSON.stringify(body);
  }

  return {
    statusCode,
    body,
    headers,
  };
};
