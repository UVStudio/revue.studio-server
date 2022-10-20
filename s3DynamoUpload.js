const aws = require('aws-sdk');
const s3 = new aws.S3({ apiVersion: '2006-03-01' });
const ddb = new aws.DynamoDB.DocumentClient();

const tableName = process.env.TABLE_NAME;
const region = process.env.REGION;
aws.config.update({ region });

exports.handler = async (event, context) => {
  console.log('event:', JSON.stringify(event));
  let body;
  let statusCode = 200;

  // Get the object from the event and show its content type
  const bucket = event.Records[0].s3.bucket.name;
  const itemKey = event.Records[0].s3.object.key;
  const arr = itemKey.split('/');
  const strS3TimeStamp = arr[2];

  const findTimeStamp = (str) => {
    const position = str.indexOf('-');
    const newStr = str.slice(0, position);
    return newStr;
  };

  const timeStamp = Date.now().toString();
  const id = findTimeStamp(strS3TimeStamp);

  const bucketParams = {
    Bucket: bucket,
    Key: itemKey,
  };

  const headObject = await s3
    .headObject(bucketParams, (err, data) => {
      if (err) {
        console.log('err: ', err);
      } else {
        console.log('success: ', data);
      }
    })
    .promise();

  let ddbParams = {
    Item: {
      id: id,
      userId: arr[0],
      projectId: arr[1],
      fileName: arr[2],
      fileSize: headObject.ContentLength,
      s3Url: itemKey,
      timeStamp: timeStamp,
    },
    TableName: tableName,
  };

  try {
    if (ddbParams.Item.fileName) {
      await ddb
        .put(ddbParams, (err, data) => {
          if (err) {
            console.log('err: ', err);
          } else {
            console.log('data: ', data);
          }
        })
        .promise();

      body = {
        message: `DynamoDB record created for ${ddbParams.Item.fileName}`,
      };
    } else {
      body = {
        message: 'Upload to S3 was not successful.',
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
  };
};
