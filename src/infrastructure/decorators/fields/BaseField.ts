import {applyDecorators} from '@nestjs/common';
import {ApiProperty} from '@nestjs/swagger';
import {ColumnType} from 'typeorm/driver/types/ColumnTypes';
import {IsNotEmpty} from 'class-validator';
import {IAllFieldOptions} from './index';

export const STEROIDS_META_FIELD = 'steroids_meta_field';
export const STEROIDS_META_FIELD_DECORATOR = 'steroids_meta_field_decorator';
export const STEROIDS_META_KEYS = 'steroids_meta_keys';

export type AppColumnType = 'boolean' | 'createTime' | 'date' | 'dateTime' | 'decimal' | 'email' | 'enum' | 'file'
    | 'html' | 'integer' | 'password' | 'phone' | 'primaryKey' | 'relation' | 'relationId' | 'string' | 'text'
    | 'time' | 'updateTime' | string;
export type JsType = 'boolean' | 'string' | 'number' | string;

export interface IBaseFieldOptions {
    appType?: AppColumnType,
    jsType?: ColumnType,
    dbType?: ColumnType,
    label?: string,
    hint?: string,
    example?: string,
    defaultValue?: any,
    required?: boolean,
    nullable?: boolean,
    isArray?: boolean,
    min?: number,
    max?: number,
    // Enum title to upload data on frontend
    items?: string,
    plainName?: string,
}

export interface IInternalFieldOptions {
    appType?: AppColumnType,
    jsType?: ColumnType,
    decoratorName?: string,
    isArray?: boolean,
}

export const getFieldOptions = (targetClass, fieldName: string): IAllFieldOptions => {
    return targetClass && Reflect.getMetadata(STEROIDS_META_FIELD, targetClass.prototype, fieldName);
};

export const isMetaClass = (MetaClass): boolean => {
    return Reflect.hasMetadata(STEROIDS_META_KEYS, MetaClass.prototype);
}

export const getMetaFields = (MetaClass): string[] => {
    return Reflect.getMetadata(STEROIDS_META_KEYS, MetaClass.prototype) || [];
}

export const getMetaRelations = (MetaClass): string[] => {
    return getMetaFields(MetaClass)
        .filter(fieldName => {
            const options = getFieldOptions(MetaClass, fieldName);
            return ['relationId', 'relation'].includes(options.appType);
        });
}

export const getFieldDecorator = (targetClass, fieldName: string): (...args: any) => PropertyDecorator => {
    const decoratorName: string = Reflect.getMetadata(STEROIDS_META_FIELD_DECORATOR, targetClass.prototype, fieldName);
    const decorator = require('./index')[decoratorName];
    if (!decorator) {
        throw new Error(`Not found Field decorator ${decoratorName}, property: ${fieldName}`);
    }

    return decorator;
};

const ColumnMetaDecorator = (options: IBaseFieldOptions, internalOptions: IInternalFieldOptions) => (object, propertyName) => {
    Reflect.defineMetadata(STEROIDS_META_FIELD, options, object, propertyName);
    Reflect.defineMetadata(STEROIDS_META_FIELD_DECORATOR, internalOptions.decoratorName, object, propertyName);

    // Add field to list
    const fieldNames = Reflect.getMetadata(STEROIDS_META_KEYS, object) || [];
    fieldNames.push(propertyName);
    Reflect.defineMetadata(STEROIDS_META_KEYS, fieldNames, object);
};

export function BaseField(options: IBaseFieldOptions = null, internalOptions: IInternalFieldOptions = {}) {
    return applyDecorators(
        ...[
            ColumnMetaDecorator({
                label: null,
                hint: null,
                items: null, // TODO
                ...options,
                isArray: internalOptions.isArray || null,
                appType: internalOptions.appType || null,
            }, internalOptions),
            ApiProperty({
                type: options.jsType,
                description: options.label || undefined,
                example: options.example || undefined,
                required: options.nullable === false,
                isArray: options.isArray,
            }),
            options.required && IsNotEmpty(),
        ].filter(Boolean)
    );
}
