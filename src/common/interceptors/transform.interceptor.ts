import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface Response<T> {
  message: string;
  data: T;
  success: boolean;
  pagination?: {
    pageNumber: number;
    pageSize: number;
    totalElements: number;
    totalPages: number;
  };
}

@Injectable()
export class TransformInterceptor<T>
  implements NestInterceptor<T, Response<T>>
{
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<Response<T>> {
    const request = context.switchToHttp().getRequest();
    const method = request.method;

    // For DELETE requests, return simple success response
    if (method === 'DELETE') {
      return next.handle().pipe(
        map(() => ({
          message: 'Resource deleted successfully',
          data: null as T,
          success: true,
        })),
      );
    }

    return next.handle().pipe(
      map((data) => {
        // If data already has the standard format, return as is
        if (
          data &&
          typeof data === 'object' &&
          'success' in data &&
          'message' in data
        ) {
          return data;
        }

        // Extract pagination metadata if present
        const pagination =
          data && typeof data === 'object' && 'meta' in data
            ? {
                pageNumber: (data as any).meta.page || 0,
                pageSize: (data as any).meta.limit || 10,
                totalElements: (data as any).meta.totalItems || 0,
                totalPages: Math.ceil(
                  ((data as any).meta.totalItems || 0) /
                    ((data as any).meta.limit || 10),
                ),
              }
            : undefined;

        return {
          message: this.getDefaultMessage(method),
          data: pagination ? (data as any).items || data : data,
          success: true,
          ...(pagination && { pagination }),
        };
      }),
    );
  }

  private getDefaultMessage(method: string): string {
    const messages: Record<string, string> = {
      GET: 'Data retrieved successfully',
      POST: 'Resource created successfully',
      PUT: 'Resource updated successfully',
      PATCH: 'Resource updated successfully',
      DELETE: 'Resource deleted successfully',
    };
    return messages[method] || 'Operation completed successfully';
  }
}

