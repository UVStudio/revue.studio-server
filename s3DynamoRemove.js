const aws = require('aws-sdk');
const ddb = new aws.DynamoDB.DocumentClient();

const videosTableName = process.env.VIDEOS_TABLE_NAME;
const commentsTableName = process.env.COMMENTS_TABLE_NAME;
const region = process.env.REGION;
aws.config.update({ region: region });

exports.handler = async (event, context) => {
  let body;
  let statusCode = 200;

  console.log('s3DynamoRemove event:', event);

  const itemKey = event.Records[0].s3.object.key;

  const arr = itemKey.split('/');
  const strS3TimeStamp = arr[2];

  const findTimeStamp = (str) => {
    const position = str.indexOf('-');
    const newStr = str.slice(0, position);
    return newStr;
  };

  const id = findTimeStamp(strS3TimeStamp);

  const params = {
    Key: {
      id,
    },
    TableName: videosTableName,
  };

  const deleteDDBCommentsParams = {
    TableName: commentsTableName,
    IndexName: 'videoId-timeStamp-index',
    ExpressionAttributeValues: {
      ':videoId': id,
    },
    KeyConditionExpression: 'videoId = :videoId',
  };

  try {
    await ddb
      .delete(params, (err, data) => {
        if (err) {
          console.log('err: ', err);
        } else {
          console.log('delete video success: ', data);
        }
      })
      .promise();

    const data = await ddb
      .query(deleteDDBCommentsParams, (err, data) => {
        if (err) {
          console.log('err: ', err);
        } else {
          console.log('Array built success. Comments to delete: ', data);
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
        console.log(`Batch ${deleteArrayNumber} to be deleted.`);

        let RequestItems = {};
        RequestItems[commentsTableName] = deleteArray;

        await ddb
          .batchWrite({ RequestItems }, (err, data) => {
            if (err) {
              console.log('err: ', err);
            } else {
              console.log('delete comment success: ', data);
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
      message: `Record for video ID ${id} removed from DynamoDB.`,
    };
  } catch (err) {
    statusCode = 400;
    body = err.message;
  } finally {
    body = JSON.stringify(body);
  }
  return {
    statusCode,
    body,
  };
};
