# Smart Mobility — SERLAB Project · Codebase Reference

> **Purpose of this document:** complete inventory of what currently exists in the code (files, class names, function names, endpoint paths, screen routes, component props). Use this as ground truth when renaming or realigning the implementation to match the official documentation.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Mobile | React Native 0.81.5 · Expo SDK 54 · TypeScript · Expo Router (file-based routing) |
| Backend | Python 3.12 · FastAPI · SQLAlchemy 2 (ORM) · SQLite (dev) · Pydantic v2 |
| Auth | JWT (python-jose) · SecureStore (mobile) · Social: Google (expo-auth-session) · Apple (expo-apple-authentication) |
| Maps | react-native-maps · OpenStreetMap Nominatim (geocoding) · OSRM demo API (routing) |

---

## Project Structure

```
Smart_Mobility_SERLAB/
├── backend/
│   └── app/
│       ├── main.py              # FastAPI app, lifespan, CORS, router registration
│       ├── models.py            # SQLAlchemy ORM models
│       ├── schemas.py           # Pydantic request/response schemas
│       ├── database.py          # SQLAlchemy engine, SessionLocal, get_db
│       ├── deps.py              # get_current_user, require_role dependencies
│       ├── security.py          # hash_password, verify_password, create_token, decode_token
│       ├── seed.py              # Initial DB data (40 vehicles, 1 demo user, promotions)
│       ├── config.py            # Settings (SECRET_KEY, GOOGLE_CLIENT_ID, etc.)
│       └── routers/
│           ├── auth.py          # /auth/*
│           ├── users.py         # /users/*
│           ├── vehicles.py      # /vehicles/*
│           ├── rides.py         # /rides/*
│           ├── wallet.py        # /wallet/*
│           ├── payment.py       # /payment-methods/*
│           ├── promotions.py    # /promotions/*
│           ├── messages.py      # /messages/*
│           ├── reports.py       # /reports/*
│           ├── geo.py           # /geocode, /route, /route/options
│           ├── parking.py       # /parking/*
│           ├── segnalazioni.py  # /segnalazioni/*
│           ├── restrizioni.py   # /aree-restrizione/*
│           ├── operatore.py     # /operatore/* (role-gated)
│           ├── amministrazione.py # /amministrazione/* (role-gated)
│           └── realtime.py      # WebSocket /ws/mezzi/{id}, /ws/notifiche
└── mobile/
    ├── app/
    │   ├── _layout.tsx          # Root layout (GestureHandlerRootView, AuthProvider)
    │   ├── index.tsx            # Redirect root -> auth or app
    │   ├── (auth)/
    │   │   ├── _layout.tsx
    │   │   ├── login.tsx
    │   │   ├── register.tsx
    │   │   └── forgot-password.tsx
    │   └── (app)/
    │       ├── _layout.tsx
    │       ├── index.tsx        # Main map screen (home)
    │       ├── search.tsx       # Vehicle list / search + filter
    │       ├── scan.tsx         # QR code scanner
    │       ├── active-ride.tsx  # Ongoing ride screen
    │       ├── end-ride.tsx     # Post-ride summary
    │       ├── reserve.tsx      # Vehicle reservation confirm
    │       ├── ride-history.tsx # Past rides list
    │       ├── wallet.tsx       # Wallet + transactions
    │       ├── payment.tsx      # Payment methods
    │       ├── promotions.tsx   # Promotions list
    │       ├── messages.tsx     # In-app messages / notifications
    │       ├── report.tsx       # Submit a report
    │       ├── profile.tsx      # User profile
    │       ├── settings.tsx     # Notification + privacy preferences
    │       └── support.tsx      # Support contacts
    ├── components/
    │   ├── map/
    │   │   ├── VehicleDetailSheet.tsx   # Bottom panel shown when a map marker is tapped
    │   │   └── ManualLocationModal.tsx  # Modal for manual GPS fallback (SA-02a)
    │   └── ui/
    │       ├── GlassCard.tsx
    │       ├── GradientButton.tsx
    │       └── VehicleCard.tsx          # Card used in search.tsx vehicle list
    ├── lib/
    │   ├── api/
    │   │   ├── client.ts        # apiFetch(), ApiError, base URL resolution
    │   │   ├── endpoints.ts     # All API client objects (authApi, vehiclesApi, etc.)
    │   │   └── types.ts         # TypeScript interfaces for all API responses
    │   ├── auth/
    │   │   └── AuthContext.tsx  # AuthProvider, useAuth hook, token persistence
    │   ├── geo.ts               # Coords interface, haversineMeters, formatDistance, walkMinutes
    │   ├── vehicles.ts          # MapVehicle interface, toMapVehicle, vehicleIcon, vehicleTypeLabel
    │   ├── useDeviceLocation.ts # useDeviceLocation hook (GPS + manual fallback)
    │   └── format.ts            # relativeTime, shortDateTime
    └── constants/
        └── theme.ts             # Colors, Gradients (design tokens)
```

---

## Backend — Database Models (`models.py`)

### `User`
| Field | Type | Notes |
|---|---|---|
| `id` | int PK | |
| `name` | str | |
| `surname` | str | |
| `email` | str unique | |
| `phone` | str nullable | |
| `password_hash` | str nullable | null for social-only accounts |
| `provider` | str | `"email"` / `"google"` / `"apple"` / `"facebook"` |
| `provider_id` | str nullable | |
| `points` | int | gamification points |
| `balance` | float | wallet balance in EUR |
| `notifications_enabled` | bool | |
| `preferences` | dict (JSON) | stores notification/privacy toggles |
| `role` | str | `"UTENTE"` / `"OPERATORE"` / `"AMMINISTRAZIONE"` |
| `account_status` | str | `"attivo"` / `"sospeso"` |
| `created_at` | datetime | |

### `Vehicle`
| Field | Type | Notes |
|---|---|---|
| `id` | int PK | |
| `name` | str | e.g. `"Smart S1-01"` |
| `model` | str | e.g. `"Pro 2024"` |
| `type` | str | `"scooter"` / `"bike"` / `"ebike"` / `"car"` |
| `lat` | float | GPS latitude (mutated by drift simulation on every list call) |
| `lng` | float | GPS longitude |
| `battery_pct` | int | 0-100 |
| `status` | str | `"available"` / `"in_use"` / `"maintenance"` |
| `unlock_fee` | float | EUR |
| `price_per_min` | float | EUR/min |
| `locked` | bool | remote lock flag (operator use) |

### `ParkingArea`
| Field | Type |
|---|---|
| `id` | int PK |
| `name` | str |
| `address` | str |
| `lat` / `lng` | float |
| `radius_m` | int |
| `capacity` | int |
| `occupied` | int |

### `Ride`
| Field | Type | Notes |
|---|---|---|
| `id` | int PK | |
| `user_id` | FK -> users | |
| `vehicle_id` | FK -> vehicles nullable | |
| `vehicle_type` | str | |
| `from_addr` | str | |
| `to_addr` | str | |
| `km` | float | |
| `minutes` | int | |
| `cost` | float | EUR |
| `points` | int | earned points |
| `status` | str | `"active"` / `"paused"` / `"completed"` |
| `started_at` | datetime | |
| `ended_at` | datetime nullable | |

### `WalletTransaction`
| Field | Type | Notes |
|---|---|---|
| `id` | int PK | |
| `user_id` | FK | |
| `type` | str | `"charge"` / `"refund"` / `"topup"` |
| `label` | str | |
| `amount` | float | negative for charges |
| `created_at` | datetime | |

### `PaymentMethod`
| Field | Type | Notes |
|---|---|---|
| `id` | int PK | |
| `user_id` | FK | |
| `kind` | str | `"card"` / `"apple"` / `"paypal"` |
| `label` | str | |
| `last4` | str nullable | |
| `is_default` | bool | |

### `Promotion`
Fields: `id`, `code`, `title`, `body`, `reward`, `icon`, `color`, `kind` (`"offer"` / `"active"`), `expiry`, `used`, `total`

### `Message`
Fields: `id`, `user_id`, `type` (`"promo"` / `"ride"` / `"alert"` / `"system"`), `title`, `body`, `read`, `created_at`

### `Segnalazione`
Fields: `id`, `user_id`, `vehicle_id`, `category`, `description`, `status` (`"aperta"` / `"chiusa"`), `created_at`, `chiusa_at`, `note_operatore`

### `AreaRestrizione`
Fields: `id`, `name`, `lat`, `lng`, `radius_m`, `type` (`"velocita"` / `"divieto"`), `max_speed_kmh`, `vehicle_types` (JSON), `active`

### `OperatoreProfile` / `AmministrazioneProfile`
Linked to `User` via `user_id`. Store role-specific metadata.

---

## Backend — Pydantic Schemas (`schemas.py`)

### Auth
- `RegisterIn`: `name, surname, email, password, phone?`
- `LoginIn`: `email, password`
- `TokenOut`: `access_token, token_type, user`
- `UserOut`: full user representation
- `UserUpdate`: `name?, surname?, phone?, notifications_enabled?`
- `ForgotPasswordIn`: `email`

### Vehicle
- `VehicleOut`: mirrors `Vehicle` model fields

### Parking
- `ParkingAreaOut`: mirrors `ParkingArea` model fields

### Ride
- `RideCreate`: `vehicle_id?, vehicle_type?, from_addr?, to_addr?`
- `RideEnd`: `km, minutes`
- `RideOut`: full ride representation

### Wallet
- `TopUpIn`: `amount`
- `WalletOut`: `balance, transactions[]`
- `TransactionOut`: mirrors `WalletTransaction`

### Payment
- `PaymentMethodIn`: `kind, label, last4?, is_default?`
- `PaymentMethodOut`: mirrors `PaymentMethod`

### Geo
- `GeocodeResult`: `display_name, lat, lng, distance_m?`
- `RoutePoint`: `lat, lng`
- `RouteOption`: `mode, duration_min, distance_km, cost_eur, points[]`

### Preferences
- `PreferencesIn`: `notif_ride?, notif_promo?, notif_system?, location_bg?, biometric?`
- `PreferencesOut`: same fields with defaults (`notif_ride=True, notif_promo=True, notif_system=False, location_bg=True, biometric=False`)

### Reports / Segnalazioni
- `ReportIn`: `category, description?`
- `ReportOut`: full report
- `SegnalazioneOut`: full segnalazione with operator fields

### Area Restrizione
- `AreaRestrizioneIn`, `AreaRestrizioneUpdate`, `AreaRestrizioneOut`

### Admin
- `AccountStatusIn`: `status`
- `VehicleLockIn`: `locked`
- `UserAdminOut`: extended user info for admin views

---

## Backend — API Endpoints

### Auth — prefix `/auth`
| Method | Path | Function | Auth |
|---|---|---|---|
| POST | `/auth/register` | `register` | public |
| POST | `/auth/login` | `login` | public |
| POST | `/auth/forgot-password` | `forgot_password` | public |
| GET | `/auth/me` | `me` | JWT |
| PATCH | `/auth/me` | `update_me` | JWT |

### Vehicles — prefix `/vehicles`
| Method | Path | Function | Auth |
|---|---|---|---|
| GET | `/vehicles` | `list_vehicles` | public |
| GET | `/vehicles/{vehicle_id}` | `get_vehicle` | public |

Query params for `list_vehicles`: `lat`, `lng`, `only_available`.
Side effect: GPS drift simulation applied on every call; vehicles repositioned near user if none within 0.05 degrees (~5km).

### Parking — prefix `/parking`
| Method | Path | Function | Auth |
|---|---|---|---|
| GET | `/parking` | `list_parking` | public |

Query params: `lat?`, `lng?`, `radius_km?`

### Rides — prefix `/rides`
| Method | Path | Function | Auth |
|---|---|---|---|
| GET | `/rides` | `history` | JWT |
| GET | `/rides/active` | `active_ride` | JWT |
| POST | `/rides` | `start_ride` | JWT |
| PATCH | `/rides/{ride_id}/pause` | `toggle_pause` | JWT |
| POST | `/rides/{ride_id}/end` | `end_ride` | JWT |

### Wallet — prefix `/wallet`
| Method | Path | Function | Auth |
|---|---|---|---|
| GET | `/wallet` | `get_wallet` | JWT |
| POST | `/wallet/topup` | `topup` | JWT |

### Payment Methods — prefix `/payment-methods`
| Method | Path | Function | Auth |
|---|---|---|---|
| GET | `/payment-methods` | `list_methods` | JWT |
| POST | `/payment-methods` | `add_method` | JWT |
| DELETE | `/payment-methods/{method_id}` | `delete_method` | JWT |

### Promotions — prefix `/promotions`
| Method | Path | Function | Auth |
|---|---|---|---|
| GET | `/promotions` | `list_promotions` | public |

### Messages — prefix `/messages`
| Method | Path | Function | Auth |
|---|---|---|---|
| GET | `/messages` | `list_messages` | JWT |
| POST | `/messages/read-all` | `mark_all_read` | JWT |
| POST | `/messages/{message_id}/read` | `mark_read` | JWT |

### Reports — prefix `/reports`
| Method | Path | Function | Auth |
|---|---|---|---|
| GET | `/reports` | `list_reports` | JWT |
| POST | `/reports` | `create_report` | JWT |

### Geo — no prefix
| Method | Path | Function | Auth |
|---|---|---|---|
| GET | `/geocode` | `geocode` | public |
| GET | `/route` | `route` | public |
| GET | `/route/options` | `route_options` | public |

`/geocode` query param: `q` (min 2 chars) -> Nominatim OpenStreetMap.
`/route` query params: `from_lat, from_lng, to_lat, to_lng` -> OSRM demo API.
`/route/options` -> returns multiple travel mode options with cost/time/points estimates.

### Users — prefix `/users`
| Method | Path | Function | Auth |
|---|---|---|---|
| GET | `/users/me/preferences` | `get_preferences` | JWT |
| PATCH | `/users/me/preferences` | `update_preferences` | JWT |

### Segnalazioni — prefix `/segnalazioni`
| Method | Path | Function | Auth |
|---|---|---|---|
| GET | `/segnalazioni` | `list_segnalazioni` | JWT (OPERATORE or owner) |
| GET | `/segnalazioni/{segn_id}` | `get_segnalazione` | JWT |
| PATCH | `/segnalazioni/{segn_id}/chiudi` | `chiudi_segnalazione` | JWT (OPERATORE) |

### Area Restrizione — prefix `/aree-restrizione`
| Method | Path | Function | Auth |
|---|---|---|---|
| GET | `/aree-restrizione` | `list_aree` | JWT |
| GET | `/aree-restrizione/verifica` | `verifica_posizione` | public |
| POST | `/aree-restrizione` | `crea_area` | JWT (AMMINISTRAZIONE) |
| PATCH | `/aree-restrizione/{area_id}` | `aggiorna_area` | JWT (AMMINISTRAZIONE) |
| DELETE | `/aree-restrizione/{area_id}` | `elimina_area` | JWT (AMMINISTRAZIONE) |

### Operatore — prefix `/operatore` (role: OPERATORE required)
| Method | Path | Function |
|---|---|---|
| GET | `/operatore/flotta` | `flotta` |
| GET | `/operatore/mezzi-rilascio` | `mezzi_rilascio` |
| GET | `/operatore/aree-densita` | `aree_densita` |
| GET | `/operatore/utenti` | `lista_utenti` |
| POST | `/operatore/utenti/{user_id}/stato` | `cambia_stato_utente` |
| POST | `/operatore/mezzi/{vehicle_id}/blocco` | `blocco_remoto` |
| POST | `/operatore/bonus` | `assegna_bonus` |

### Amministrazione — prefix `/amministrazione` (role: AMMINISTRAZIONE required)
| Method | Path | Function |
|---|---|---|
| GET | `/amministrazione/statistiche/utilizzo` | `utilizzo_per_tipo` |
| GET | `/amministrazione/statistiche/tratte` | `tratte_piu_usate` |
| GET | `/amministrazione/statistiche/zone-critiche` | `zone_critiche` |
| GET | `/amministrazione/report` | `report_aggregato` |

### Realtime — WebSocket
| Path | Description |
|---|---|
| `/ws/mezzi/{vehicle_id}` | streams vehicle GPS position every second |
| `/ws/notifiche` | streams notifications to authenticated user |

---

## Frontend — API Client (`lib/api/endpoints.ts`)

All methods return `Promise<T>` and throw `ApiError` on non-2xx responses.

### `authApi`
| Method | HTTP call |
|---|---|
| `register(body)` | POST `/auth/register` |
| `login(body)` | POST `/auth/login` |
| `me(token)` | GET `/auth/me` |
| `updateMe(token, body)` | PATCH `/auth/me` |
| `forgotPassword(email)` | POST `/auth/forgot-password` |

Social login is handled inside `AuthContext.tsx` via `socialLogin(provider, idToken)` which calls POST `/auth/login` with `{ provider, token }`.

### `vehiclesApi`
| Method | HTTP call |
|---|---|
| `list(onlyAvailable?, lat?, lng?)` | GET `/vehicles` |
| `get(id)` | GET `/vehicles/{id}` |

### `parkingApi`
| Method | HTTP call |
|---|---|
| `list(lat?, lng?)` | GET `/parking` |

### `ridesApi`
| Method | HTTP call |
|---|---|
| `history(token)` | GET `/rides` |
| `active(token)` | GET `/rides/active` |
| `start(token, body)` | POST `/rides` |
| `end(token, rideId, body)` | POST `/rides/{rideId}/end` |
| `pause(token, rideId)` | PATCH `/rides/{rideId}/pause` |

### `usersApi`
| Method | HTTP call |
|---|---|
| `getPreferences(token)` | GET `/users/me/preferences` |
| `updatePreferences(token, body)` | PATCH `/users/me/preferences` |

### `geoApi`
| Method | HTTP call |
|---|---|
| `geocode(q)` | GET `/geocode?q=...` |
| `route(from, to)` | GET `/route?from_lat=...` |
| `routeOptions(from, to, vehicleType)` | GET `/route/options?...` |

### `walletApi`
| Method | HTTP call |
|---|---|
| `get(token)` | GET `/wallet` |
| `topup(token, amount)` | POST `/wallet/topup` |

### `paymentApi`
| Method | HTTP call |
|---|---|
| `list(token)` | GET `/payment-methods` |
| `add(token, body)` | POST `/payment-methods` |
| `remove(token, id)` | DELETE `/payment-methods/{id}` |

### `promotionsApi`
| Method | HTTP call |
|---|---|
| `list()` | GET `/promotions` |

### `messagesApi`
| Method | HTTP call |
|---|---|
| `list(token)` | GET `/messages` |
| `markAllRead(token)` | POST `/messages/read-all` |
| `markRead(token, id)` | POST `/messages/{id}/read` |

### `reportsApi`
| Method | HTTP call |
|---|---|
| `list(token)` | GET `/reports` |
| `create(token, body)` | POST `/reports` |

---

## Frontend — TypeScript Interfaces (`lib/api/types.ts`)

| Interface | Maps to backend model/schema |
|---|---|
| `ApiUser` | `User` / `UserOut` |
| `TokenResponse` | `TokenOut` |
| `ApiVehicle` | `Vehicle` / `VehicleOut` |
| `ApiParkingArea` | `ParkingArea` / `ParkingAreaOut` |
| `ApiRide` | `Ride` / `RideOut` |
| `ApiTransaction` | `WalletTransaction` / `TransactionOut` |
| `ApiWallet` | `WalletOut` |
| `ApiPaymentMethod` | `PaymentMethod` / `PaymentMethodOut` |
| `ApiPromotion` | `Promotion` / `PromotionOut` |
| `ApiMessage` | `Message` / `MessageOut` |
| `ApiReport` | report model / `ReportOut` |
| `ApiPreferences` | `PreferencesOut` |
| `ApiGeocodeResult` | `GeocodeResult` |
| `ApiRoutePoint` | `RoutePoint` |
| `ApiRouteOption` | `RouteOption` |

---

## Frontend — Auth (`lib/auth/AuthContext.tsx`)

State: `user: ApiUser | null`, `token: string | null`, `initializing: boolean`
Token storage key: `"sm_token"` in expo-secure-store.

Functions exported via `useAuth()`:
| Function | Description |
|---|---|
| `login(email, password)` | email/password login, persists token |
| `register(data)` | new account creation |
| `logout()` | clears token and user state |
| `refreshUser()` | re-fetches current user from `/auth/me` |
| `socialLogin(provider, idToken)` | Google / Apple / Facebook OAuth |

---

## Frontend — Lib Utilities

### `lib/geo.ts`
| Export | Description |
|---|---|
| `Coords` | interface `{ latitude: number; longitude: number }` |
| `haversineMeters(a, b)` | distance in meters between two Coords |
| `formatDistance(meters)` | human string: `"120 m"` or `"2,4 km"` |
| `walkMinutes(meters)` | estimated walking minutes at 80 m/min |

### `lib/vehicles.ts`
| Export | Description |
|---|---|
| `MapVehicle` | interface `{ id, name, model, type, lat, lng, batteryPct }` |
| `toMapVehicle(v)` | converts `ApiVehicle` (snake_case) to `MapVehicle` (camelCase) |
| `vehicleIcon` | `Record<VehicleType, string>` — MaterialCommunityIcons icon name per type |
| `vehicleTypeLabel` | `Record<VehicleType, string>` — Italian display label per type |
| `MAP_VEHICLES` | static array (legacy fallback, not used in production screens) |

### `lib/useDeviceLocation.ts`
Returns `DeviceLocation` object:
| Field / Method | Description |
|---|---|
| `coords` | current `Coords` or null |
| `status` | `"idle"` / `"loading"` / `"granted"` / `"denied"` / `"error"` |
| `error` | error string or null |
| `source` | `"gps"` / `"manual"` / null |
| `locate()` | requests permission and fetches GPS position (High accuracy) |
| `setManualCoords(c)` | manually sets coordinates (SA-02a fallback) |
| `geocodeAddress(address)` | geocodes a string address to `Coords` via expo-location |

### `lib/format.ts`
| Export | Description |
|---|---|
| `relativeTime(iso)` | e.g. `"2 ore fa"` |
| `shortDateTime(iso)` | e.g. `"22 giu, 14:30"` |

---

## Frontend — Screens

### Auth group `(auth)/`
| File | Route | Description |
|---|---|---|
| `login.tsx` | `/(auth)/login` | Email login + social buttons (Google, Apple, Facebook) |
| `register.tsx` | `/(auth)/register` | New account form |
| `forgot-password.tsx` | `/(auth)/forgot-password` | Email input -> calls `authApi.forgotPassword` -> shows sent confirmation |

### App group `(app)/`
| File | Route | Key API calls | Notes |
|---|---|---|---|
| `index.tsx` | `/(app)/` | `vehiclesApi.list` (polling every 8s + immediate re-fetch on GPS ready). `geoApi.geocode` on search query. | Renders `VehicleDetailSheet` + `ManualLocationModal`. Map center follows GPS. |
| `search.tsx` | `/(app)/search` | `vehiclesApi.list`. `ridesApi.start` on "Inizia corsa". | Filter UI: type / battery / distance. Sort tabs: best / fastest / cheapest. |
| `scan.tsx` | `/(app)/scan` | `ridesApi.start` | Parses vehicle ID from QR data string. Also supports manual code entry. |
| `active-ride.tsx` | `/(app)/active-ride` | `ridesApi.active`, `geoApi.geocode`, `geoApi.route`, `ridesApi.pause`, `ridesApi.end` | Route drawn on MapView via OSRM. Timer counts up. Cost = (seconds/60) * 0.22. |
| `end-ride.tsx` | `/(app)/end-ride` | none (receives params) | Params: `km, minutes, cost, points, vehicleType` |
| `reserve.tsx` | `/(app)/reserve` | none | Confirmation screen before starting ride |
| `ride-history.tsx` | `/(app)/ride-history` | `ridesApi.history` | |
| `wallet.tsx` | `/(app)/wallet` | `walletApi.get` | Top-up flow included |
| `payment.tsx` | `/(app)/payment` | `paymentApi.list`, `paymentApi.add`, `paymentApi.remove` | |
| `promotions.tsx` | `/(app)/promotions` | `promotionsApi.list` | |
| `messages.tsx` | `/(app)/messages` | `messagesApi.list`, `messagesApi.markAllRead`, `messagesApi.markRead` | |
| `report.tsx` | `/(app)/report` | `reportsApi.create` | |
| `profile.tsx` | `/(app)/profile` | user data from `AuthContext`. Ride stats from API. | Termini/Privacy open via `Linking.openURL`. |
| `settings.tsx` | `/(app)/settings` | `usersApi.getPreferences` on mount. `usersApi.updatePreferences` on every toggle change. | Preferences: `notif_ride, notif_promo, notif_system, location_bg, biometric` |
| `support.tsx` | `/(app)/support` | none | Live chat -> `router.push('/(app)/messages')`. Phone -> `Linking.openURL('tel:...')`. Email -> `Linking.openURL('mailto:...')`. |

---

## Frontend — Components

### `VehicleDetailSheet` (`components/map/VehicleDetailSheet.tsx`)
Props: `vehicle: MapVehicle | null`, `userCoords: Coords | null`, `onClose: () => void`, `onReserve: (vehicle: MapVehicle) => void`

Implementation: uses `Animated.Value` (no external library). Slides up from bottom when `vehicle` is non-null. States: peek (partially visible) and expanded (full). Displays: vehicle type, model, battery color-coded, distance from user, hardcoded pricing (unlock EUR 1.00 + EUR 0.22/min). CTA "Prenota ora" calls `onReserve`.

### `ManualLocationModal` (`components/map/ManualLocationModal.tsx`)
Props: `visible`, `reason`, `onConfirm(coords)`, `onRetryGps()`
Shown when GPS is denied or unavailable (SA-02a fallback). Allows text address input -> geocoded to coords.

### `VehicleCard` (`components/ui/VehicleCard.tsx`)
Used in `search.tsx` vehicle list. Props: `vehicle: Vehicle`, `selected: boolean`, `onPress: (v: Vehicle) => void`

### `GradientButton` (`components/ui/GradientButton.tsx`)
Props: `title`, `onPress`, `loading?`, `full?`, `icon?`

### `GlassCard` (`components/ui/GlassCard.tsx`)
Decorative glass-effect container component.

---

## Seed Data (`seed.py`)

- **40 vehicles** randomly distributed within ~2.5km of Bari center (41.1177, 16.8718). Mix of scooter / ebike / bike in rotation. All `status="available"`, battery 30-100%, realistic pricing.
- **1 demo user:** `claudio@smartmobility.it` / `password123`
- **6 completed rides** with realistic addresses and metrics
- **6 wallet transactions** (charges, topups, refund)
- **1 payment method** (Visa, default)
- **5 in-app messages**
- **5 promotions**

---

## Notable Implementation Details

- **Vehicle GPS simulation:** every `GET /vehicles` call applies `+/- 0.0001 degrees` (~10m) drift to all available vehicles. If no vehicle is within `0.05 degrees` (~5km) of the user's `lat/lng`, up to 10 vehicles are repositioned randomly within `+/- 0.01 degrees` of the user.
- **Ride status flow:** `active` -> (toggle pause) -> `paused` -> (toggle pause) -> `active` -> (end) -> `completed`. The `/rides/active` endpoint returns rides with status `active` OR `paused`.
- **JWT session:** stored in expo-secure-store under key `"sm_token"`. Decoded on app start to restore session without requiring login.
- **Social auth limitation:** Google and Apple sign-in do not work in Expo Go; they require an EAS development build. Documented in `lib/auth/useSocialAuth.ts`.
- **Preferences persistence:** `User.preferences` is a JSON column in SQLite. `GET /users/me/preferences` merges stored values over hardcoded defaults. `PATCH /users/me/preferences` accepts partial updates.
- **Role system:** three roles (`UTENTE`, `OPERATORE`, `AMMINISTRAZIONE`). Role-gated routers (`operatore.py`, `amministrazione.py`) use `require_role()` dependency. Regular user endpoints use `get_current_user` dependency from `deps.py`.
- **Backend URL resolution (mobile):** `lib/api/client.ts` reads `Constants.expoConfig?.hostUri` from Expo to auto-detect the Metro bundler IP, so the app works on physical devices on the same Wi-Fi without hardcoding an IP address.
