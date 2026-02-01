import {
  PipeTransform,
  Injectable,
  ArgumentMetadata,
  BadRequestException,
} from '@nestjs/common';
import { Types } from 'mongoose';

@Injectable()
export class UuidValidationPipe implements PipeTransform {
  transform(value: any, metadata: ArgumentMetadata) {
    // Check if it's a valid MongoDB ObjectId
    if (!Types.ObjectId.isValid(value)) {
      throw new BadRequestException(`Invalid ID format: ${value}`);
    }
    return value;
  }
}

