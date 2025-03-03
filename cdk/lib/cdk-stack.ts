import * as cdk from "aws-cdk-lib";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as cloudfront from "aws-cdk-lib/aws-cloudfront";
import * as origins from "aws-cdk-lib/aws-cloudfront-origins";
import * as s3deploy from "aws-cdk-lib/aws-s3-deployment";
import * as iam from "aws-cdk-lib/aws-iam";
import { RemovalPolicy } from "aws-cdk-lib";

const DIST_DIR_LOCATION: string = "../dist";

export class WebsiteStack extends cdk.Stack {
    constructor(scope: cdk.App, id: string, props?: cdk.StackProps) {
        super(scope, id, props);

        const websiteBucket = new s3.Bucket(this, "WebsiteBucket", {
            removalPolicy: RemovalPolicy.DESTROY,
            autoDeleteObjects: true,
            blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
        });

        // Create Origin Access Identity
        const cloudfrontOAI = new cloudfront.OriginAccessIdentity(
            this,
            "CloudFrontOAI",
            {
                comment: "OAI for website content",
            }
        );

        // Grant read permissions to CloudFront
        websiteBucket.addToResourcePolicy(
            new iam.PolicyStatement({
                actions: ["s3:GetObject"],
                resources: [websiteBucket.arnForObjects("*")],
                principals: [
                    new iam.CanonicalUserPrincipal(
                        cloudfrontOAI.cloudFrontOriginAccessIdentityS3CanonicalUserId
                    ),
                ],
            })
        );

        const distribution = new cloudfront.Distribution(this, "Distribution", {
            defaultBehavior: {
                origin: new origins.S3Origin(websiteBucket, {
                    originAccessIdentity: cloudfrontOAI,
                }),
                viewerProtocolPolicy:
                    cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
                cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
            },
            defaultRootObject: "index.html",
            errorResponses: [
                {
                    httpStatus: 404,
                    responseHttpStatus: 200,
                    responsePagePath: "/index.html",
                },
            ],
        });

        new s3deploy.BucketDeployment(this, "S3BucketURL", {
            sources: [s3deploy.Source.asset(DIST_DIR_LOCATION)],
            destinationBucket: websiteBucket,
            distribution: distribution,
            distributionPaths: ["/*"],
        });

        new cdk.CfnOutput(this, "DistributionDomainName", {
            value: distribution.distributionDomainName,
            description: "CloudFront distribution URL",
        });
    }
}
