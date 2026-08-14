export interface DemoStop {
  address: string;
  latitude: number;
  longitude: number;
}

// Real coordinates around Delhi/NCR so a reviewer can click "Optimize" with
// no typing. Depot is India Gate; the rest are well-known landmarks spread
// across the city so the optimization has a real effect to show off.
export const DEMO_DEPOT: DemoStop = {
  address: 'India Gate, New Delhi',
  latitude: 28.6129,
  longitude: 77.2295,
};

export const DEMO_STOPS: DemoStop[] = [
  { address: 'Red Fort, Delhi', latitude: 28.6562, longitude: 77.241 },
  { address: 'Qutub Minar, Delhi', latitude: 28.5245, longitude: 77.1855 },
  { address: 'Lotus Temple, Delhi', latitude: 28.5535, longitude: 77.2588 },
  { address: 'Humayun\u2019s Tomb, Delhi', latitude: 28.5933, longitude: 77.2507 },
  { address: 'Akshardham Temple, Delhi', latitude: 28.6127, longitude: 77.2773 },
  { address: 'Connaught Place, New Delhi', latitude: 28.6315, longitude: 77.2167 },
  { address: 'Chandni Chowk, Delhi', latitude: 28.6506, longitude: 77.2303 },
  { address: 'Cyber Hub, Gurugram', latitude: 28.4949, longitude: 77.0891 },
  { address: 'Kingdom of Dreams, Gurugram', latitude: 28.4692, longitude: 77.0684 },
];
