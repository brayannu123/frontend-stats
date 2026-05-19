variable "aws_region" {
  description = "AWS region to deploy resources"
  type        = string
  default     = "us-east-1"
}

variable "project_name" {
  description = "Name of the project"
  type        = string
  default     = "frontend-stats"
}

variable "environment" {
  description = "Environment name"
  type        = string
  default     = "dev"
}

variable "cloudfront_price_class" {
  description = "CloudFront price class for the frontend distribution"
  type        = string
  default     = "PriceClass_100"
}
