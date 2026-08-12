import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { requestContext } from './request-context';

/** Enriquece ALS com userId após JWT (middleware roda antes do Passport). */
@Injectable()
export class RequestContextUserInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<{
      user?: { id?: string };
      ip?: string;
    }>();
    const store = requestContext.getStore();
    if (store && req.user?.id) {
      store.userId = req.user.id;
      if (req.ip) store.ip = req.ip;
    }
    return next.handle();
  }
}
