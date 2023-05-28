import * as cdk from "aws-cdk-lib";
import { CfnOutput, Duration, Expiration, RemovalPolicy } from "aws-cdk-lib";
import { AttributeType, BillingMode, Table } from "aws-cdk-lib/aws-dynamodb";
import { Construct } from "constructs";
import {
  GraphqlApi,
  SchemaFile,
  AuthorizationType,
  FieldLogLevel,
  MappingTemplate,
} from "@aws-cdk/aws-appsync-alpha";
import * as path from "path";

export class BackendStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // DynamoDB
    const userTable = new Table(this, "User Table", {
      removalPolicy: RemovalPolicy.DESTROY,
      billingMode: BillingMode.PAY_PER_REQUEST,
      partitionKey: { name: "userId", type: AttributeType.STRING },
    });

    // AppSync
    const api = new GraphqlApi(this, "User API", {
      name: "User API",
      schema: SchemaFile.fromAsset(
        path.join(__dirname, "graphql/schema.graphql")
      ),
      authorizationConfig: {
        defaultAuthorization: {
          authorizationType: AuthorizationType.API_KEY,
          apiKeyConfig: {
            description: "public scan for Users",
            expires: Expiration.after(Duration.days(30)),
            name: "API Key for demo",
          },
        },
      },
      logConfig: {
        fieldLogLevel: FieldLogLevel.ALL,
      },
      xrayEnabled: true,
    });

    // VTL Resolve
    const userTableDataSource = api.addDynamoDbDataSource(
      "userDataSource",
      userTable
    );
    // mutation
    userTableDataSource.createResolver("mutationCreateUser", {
      typeName: "Mutation",
      fieldName: "createUser",
      requestMappingTemplate: MappingTemplate.fromFile(
        path.join(
          __dirname,
          "graphql/mappingTemplates/Mutation.createUser.req.vtl"
        )
      ),
      responseMappingTemplate: MappingTemplate.dynamoDbResultItem(),
    });

    // query
    userTableDataSource.createResolver("queryListUsers", {
      typeName: "Query",
      fieldName: "listUsers",
      requestMappingTemplate: MappingTemplate.fromFile(
        path.join(__dirname, "graphql/mappingTemplates/Query.listUsers.req.vtl")
      ),
      responseMappingTemplate: MappingTemplate.fromFile(
        path.join(__dirname, "graphql/mappingTemplates/Query.listUsers.res.vtl")
      ),
    });

    // export configure for client
    new CfnOutput(this, "GraphQLAPIID", {
      value: api.apiId,
    });

    new CfnOutput(this, "GraphQLURL", {
      value: api.graphqlUrl,
    });

    new CfnOutput(this, "GraphQLAPIKey", {
      value: api.apiKey || "",
    });
  }
}
