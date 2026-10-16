export interface Hold {
  holdId: string;
  showId: string;
  userId: string;
  seatIds: string[];
}

export interface HoldResult extends Hold {
  expiresAt: string;
}

export interface ConfirmResult extends Hold {
  status: "confirmed";
  bookingIds: string[];
}
