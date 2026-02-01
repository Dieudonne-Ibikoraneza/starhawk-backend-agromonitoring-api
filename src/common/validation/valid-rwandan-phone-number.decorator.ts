import {
  registerDecorator,
  ValidationOptions,
} from 'class-validator';
import { RwandanPhoneNumberValidator } from './rwandan-phone-number.validator';

export function ValidRwandanPhoneNumber(
  validationOptions?: ValidationOptions,
) {
  return function (object: Object, propertyName: string) {
    registerDecorator({
      name: 'validRwandanPhoneNumber',
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      validator: RwandanPhoneNumberValidator,
    });
  };
}

