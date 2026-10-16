export interface Show {
  id: string;
  name: string;
  startsAt: string;
}

export type SeatStatus = "available" | "held" | "booked";

export interface Seat {
  seatId: string;
  status: SeatStatus;
}

export interface SeatMap {
  showId: string;
  seats: Seat[];
}
