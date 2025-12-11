export interface User {
  uid: string;
  email: string;
  name?: string;
  photoUrl?: string;
  createdAt: Date;
  lastConnection: Date;
}
