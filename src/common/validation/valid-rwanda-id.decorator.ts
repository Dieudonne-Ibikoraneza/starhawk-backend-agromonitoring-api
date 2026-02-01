import {
  registerDecorator,
  ValidationOptions,
  ValidationArguments,
} from 'class-validator';
import { RwandaNationalIdValidator } from './rwanda-national-id.validator';

export function ValidRwandaId(validationOptions?: ValidationOptions) {
  return function (object: Object, propertyName: string) {
    registerDecorator({
      name: 'validRwandaId',
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      validator: RwandaNationalIdValidator,
    });
  };
}

