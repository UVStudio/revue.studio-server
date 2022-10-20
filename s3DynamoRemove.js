const aws = require('aws-sdk');
const s3 = new aws.S3({ apiVersion: '2006-03-01' });
const ddb = new aws.DynamoDB.DocumentClient();

const tableName = process.env.TABLE_NAME;
const region = process.env.REGION;
aws.config.update({ region: region });

exports.handler = async (event, context) => {
  let body;
  let statusCode = 200;

  console.log('event:', event);

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
    TableName: tableName,
  };

  try {
    await ddb
      .delete(params, (err, data) => {
        if (err) {
          console.log('err: ', err);
        } else {
          console.log('success: ', data);
        }
      })
      .promise();

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
