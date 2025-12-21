# Railway persistent storage for profile photos (API service)

This app can store uploaded **profile photos** on a **Railway Volume** mounted into the **API** service.

## 1) Create + mount a volume on the API service

In Railway:

- Open your project → select the **API** service
- Go to **Settings** → **Volumes** → **Add Volume**
- Set **Mount Path** to:
  - `/data` (recommended)
- Choose a size (start small; you can increase later)
- Deploy/restart the service after adding the volume

## 2) Set the uploads directory env var

In the **API** service environment variables, set:

- `UPLOADS_DIR=/data/uploads`

The API will create these folders automatically:

- `/data/uploads/profile-photos`

## 3) How the app serves photos

- Upload endpoint (coach/player):
  - `POST /users/me/profile-photo` (multipart form-data, field name: `file`)
- Photos are served publicly from:
  - `GET /uploads/profile-photos/<file>`

## 4) Important production caveat (scaling)

Railway volumes are attached to a specific service instance. If you run **multiple API replicas**, each replica would have its own filesystem state, which can cause “missing images” depending on which replica serves the request.

Recommended options:

- **Run a single API replica** when using volume-backed uploads, or
- Use object storage (S3/R2) or Cloudinary for images if you need horizontal scaling.


