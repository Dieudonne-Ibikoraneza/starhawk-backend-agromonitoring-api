import {
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
} from 'class-validator';

@ValidatorConstraint({ name: 'ValidEnum', async: false })
export class EnumValidator implements ValidatorConstraintInterface {
  validate(value: any, args: ValidationArguments): boolean {
    const [enumType] = args.constraints;
    if (!enumType) {
      return false;
    }

    const enumValues = Object.values(enumType);
    return enumValues.includes(value);
  }

  defaultMessage(args: ValidationArguments): string {
    const [enumType] = args.constraints;
    const enumValues = Object.values(enumType);
    return `${args.property} must be one of the following values: ${enumValues.join(', ')}`;
  }
}

