# Frontend Image Upload Feature

## Fixed Issues

### 1. Import Error
- **Problem**: `UserProfile` component import was looking for wrong file
- **Solution**: Changed import from `'./pages/UserProfile'` to `'./pages/MyProfile'`

### 2. Image Upload Feature Added

## New Features

### Image Upload UI
- **Location**: Feed component ([apps/web/src/pages/Feed.tsx](apps/web/src/pages/Feed.tsx))
- **Icon Button**: Blue button with image icon (📷) labeled "Add Image"
- **Multiple Images**: Users can select and upload multiple images per post
- **Image Previews**: Selected images show thumbnails with remove buttons (×)
- **File Validation**: 
  - Only image files allowed
  - Max 10MB per image
  - Supports: JPG, PNG, GIF, WebP

### User Flow

1. **Select Images**:
   - Click "Add Image" button
   - Choose one or more images from device
   - See instant preview thumbnails

2. **Remove Images** (Optional):
   - Click × button on any preview to remove it

3. **Create Post**:
   - Write text (optional - can post images without text)
   - Click "Post" button
   - Images upload first, then post is created with image CIDs

4. **View Posts**:
   - Images display in a 2-column grid below post text
   - Click images to view full size
   - Automatic fallback to ipfs.io if nftstorage.link fails

## Technical Implementation

### New State Variables
```typescript
const [selectedImages, setSelectedImages] = useState<File[]>([])
const [uploadingImages, setUploadingImages] = useState(false)
const [imagePreviewUrls, setImagePreviewUrls] = useState<string[]>([])
```

### Image Upload Function
```typescript
const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
  // Validates file type and size
  // Creates preview URLs using FileReader
  // Updates state with selected files
}
```

### Post Creation with Images
```typescript
// 1. Upload images to IPFS (parallel)
// 2. Get CIDs for all images
// 3. Create post with text + media_cids array
// 4. Clear form and reload feed
```

### Image Display in Posts
```typescript
{p.media_cids?.length > 0 && (
  <div className="grid grid-cols-2 gap-2">
    {p.media_cids.map((cid, idx) => (
      <img src={`https://${cid}.ipfs.nftstorage.link`} />
    ))}
  </div>
)}
```

## UI Components

### Add Image Button
- **Style**: Blue background with image icon
- **Icon**: SVG image icon (photo/gallery symbol)
- **Text**: "Add Image"
- **Disabled**: When posting or uploading

### Image Previews
- **Size**: 80x80 pixels (w-20 h-20)
- **Layout**: Horizontal flex wrap
- **Remove Button**: Red circle with × in top-right corner
- **Border**: Rounded with border

### Posted Images
- **Layout**: 2-column grid
- **Max Height**: 300px
- **Object Fit**: Cover (maintains aspect ratio)
- **Borders**: Rounded
- **Fallback**: Automatic gateway switching on error

## Button States

- **Normal**: "Post" (green button)
- **Uploading Images**: "Uploading Images..." (disabled)
- **Creating Post**: "Posting..." (disabled)

## Error Handling

- Invalid file type → Shows error message
- File too large → Shows error message  
- Upload failure → Shows detailed error
- Image load failure → Falls back to ipfs.io gateway

## API Integration

### Upload Image Endpoint
```typescript
POST /api/posts/upload-image
Headers: Authorization: Bearer <token>
Body: FormData with 'file' field
Response: { cid: string, url: string }
```

### Create Post with Images
```typescript
POST /api/posts
Body: {
  author_wallet: string,
  content: string,
  media_cids: string[], // Image CIDs
  tags: string[]
}
```

## Styling

All styling uses Tailwind CSS classes:
- Responsive grid layout
- Hover effects on buttons
- Disabled states with opacity
- Smooth transitions
- Clean, modern design

## Browser Compatibility

- FileReader API for previews
- FormData for uploads
- Modern ES6+ features
- Tested in latest Chrome, Firefox, Safari, Edge
