const AWS = require('aws-sdk');
const dynamo = new AWS.DynamoDB.DocumentClient();
const userTable = process.env.USER_TABLE;

exports.handler = async (event, context) => {
  let body;
  let statusCode = 200;
  const headers = {
    'Content-Type': 'application/json',
  };

  try {
    switch (event.routeKey) {
      //DELETE User by ID
      case 'DELETE /users/{id}':
        await dynamo
          .delete(
            {
              TableName: userTable,
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
        body = `Deleted user ${event.pathParameters.id}`;
        break;

      //GET User by ID
      case 'GET /users/{id}':
        body = await dynamo
          .get(
            {
              TableName: userTable,
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

      //GET all users
      case 'GET /users':
        body = await dynamo.scan({ TableName: userTable }).promise();
        break;

      //UPDATE user by ID
      case 'PUT /users/{id}':
        const requestJSON = JSON.parse(event.body);
        const params = {
          Key: {
            id: event.pathParameters.id,
          },
          ExpressionAttributeNames: {
            '#name': 'name',
            '#city': 'city',
            '#country': 'country',
            '#company': 'company',
            '#description': 'description',
          },
          ExpressionAttributeValues: {
            ':name': requestJSON.form.name,
            ':city': requestJSON.form.city,
            ':country': requestJSON.form.country,
            ':company': requestJSON.form.company,
            ':description': requestJSON.form.description,
          },
          UpdateExpression:
            'SET #name = :name, #city = :city, #country = :country, #company = :company, #description = :description',
          TableName: userTable,
        };
        await dynamo
          .update(params, (err, data) => {
            if (err) {
              console.log(err);
            } else {
              console.log(data);
            }
          })
          .promise();

        body = {
          message: `Put user ${event.pathParameters.id}`,
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
