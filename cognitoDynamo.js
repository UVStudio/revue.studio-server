const aws = require('aws-sdk');
const ddb = new aws.DynamoDB({ apiVersion: '2012-10-08' });
const s3 = new aws.S3({ apiVersion: '2006-03-01' });

const tableName = process.env.TABLE_NAME;
const region = process.env.REGION;
const bucketName = process.env.BUCKET_NAME;
aws.config.update({ region: region });

exports.handler = async (event, context) => {
  let date = new Date();

  console.log('table=' + tableName + ' -- region=' + region);

  // If the required parameters are present, proceed
  if (event.request.userAttributes.sub) {
    // -- Write data to DDB
    let ddbParams = {
      Item: {
        id: { S: event.request.userAttributes.sub },
        username: { S: event.request.userAttributes.email },
        email: { S: event.request.userAttributes.email },
        createdAt: { S: date.toISOString() },
      },
      TableName: tableName,
    };

    const bucketParams = {
      Bucket: bucketName,
      Key: `${event.request.userAttributes.sub}/`,
      ACL: 'public-read',
    };

    // Call DynamoDB and S3
    try {
      await ddb.putItem(ddbParams).promise();
      console.log('Success with DDB');
      await s3.putObject(bucketParams).promise();
      console.log('Success with S3');
    } catch (err) {
      console.log('Error', err);
    }

    console.log('Success: Everything executed correctly');
    context.done(null, event);
  } else {
    // Nothing to do, the user's email ID is unknown
    console.log('Error: Nothing was written to DDB or SQS');
    context.done(null, event);
  }
};
