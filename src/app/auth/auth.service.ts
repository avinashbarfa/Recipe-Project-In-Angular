import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { catchError, tap } from 'rxjs/operators';
import { BehaviorSubject, throwError} from 'rxjs';
import { User } from './user.model';
import { Router } from '@angular/router';

export interface AuthResponseData {
  kind: string;
  idToken: string;
  email: string;
  refreshToken: string;
  expiresIn: string;
  localId: string;
  registered?: boolean;
}

@Injectable({providedIn: 'root'})
export class AuthService {
  FIREBASE_API_KEY = environment.firebaseAPIKey;
  user = new BehaviorSubject<User>(null);
  private tokenExpirationTimer: any;

  constructor(private http: HttpClient,
              private router: Router) {}

  signUp(email: string, password: string) {
    return this.http.
      post<AuthResponseData>('https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=' + this.FIREBASE_API_KEY,
      { email,
              password,
              returnSecureToken: true
            }
      ).pipe(
          catchError(this.handleError),
          tap(responseData => {
            this.handleAuthentication(responseData.email, responseData.localId, responseData.idToken, +responseData.expiresIn);
          })
      );
  }

  login(email: string, password: string) {
    return this.http.
    post<AuthResponseData>('https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=' + this.FIREBASE_API_KEY,
      { email,
        password,
        returnSecureToken: true
      }
    ).pipe(
        catchError(this.handleError),
        tap(responseData => {
          this.handleAuthentication(responseData.email, responseData.localId, responseData.idToken, +responseData.expiresIn);
        })
    );
  }

  logout() {
    this.user.next(null);
    this.router.navigate(['./auth']);
    localStorage.removeItem('userData');
    if (this.tokenExpirationTimer) {
      clearTimeout(this.tokenExpirationTimer);
    }
    this.tokenExpirationTimer = null;
  }

  autoLogin() {
    const userData: {
      email: string,
      id: string,
      _token: string;
      _tokenExpirationDate: string;
    } = JSON.parse(localStorage.getItem('userData'));
    if (!userData) {
      return;
    }
    const loadedUser = new User(
      userData.email,
      userData.id,
      userData._token,
      new Date(userData._tokenExpirationDate));

    if (loadedUser.getUserToken()) {
      this.user.next(loadedUser);
      const expirationDuration = new Date(userData._tokenExpirationDate).getTime() - new Date().getTime();
      this.autoLogout(expirationDuration);
    }
  }

  autoLogout(expirationDuration: number) {
     this.tokenExpirationTimer = setTimeout(() => {
       this.logout();
     } , expirationDuration);
  }

  private handleError(errorResponse: HttpErrorResponse) {
    let errorMsg = 'An unknown Occurred';
    if (!errorResponse.error || !errorResponse.error.error) {
      return throwError(errorMsg);
    }
    switch (errorResponse.error.error.message) {
      case 'INVALID_PASSWORD': {
        errorMsg = 'Password is Incorrect';
        break;
      }
      case 'EMAIL_NOT_FOUND': {
        errorMsg = 'Account with Email Doesn\'t exist';
        break;
      }
      case 'USER_DISABLED': {
        errorMsg = 'Account is Disabled';
        break;
      }
      case 'EMAIL_EXISTS': {
        errorMsg = 'Email Id Already Exists';
        break;
      }
    }
    return throwError(errorMsg);
    }

    private handleAuthentication(email: string, userId: string, token: string, expiresIn: number) {
      const expirationDate =  new Date(new Date().getTime() + expiresIn * 1000);
      const user = new User(email, userId, token, expirationDate);
      this.user.next(user);
      this.autoLogout(expiresIn * 1000);
      localStorage.setItem('userData', JSON.stringify(user));
    }
}
