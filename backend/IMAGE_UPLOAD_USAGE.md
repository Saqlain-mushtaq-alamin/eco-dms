# Image Upload Usage Guide

## Overview
The post system now supports image uploads to IPFS. Users can upload images and attach them to posts using the `media_cids` field.

## How to Use

### 1. Upload an Image

**Endpoint:** `POST /api/posts/upload-image`

**Headers:**
```
Authorization: Bearer <your-jwt-token>
Content-Type: multipart/form-data
```

**Request Body:**
- `file`: Image file (jpg, jpeg, png, gif, webp)
- Max size: 10MB

**Response:**
```json
{
  "cid": "bafybeig...",
  "url": "https://bafybeig....ipfs.nftstorage.link"
}
```

### 2. Create a Post with Image

**Endpoint:** `POST /api/posts`

**Headers:**
```
Authorization: Bearer <your-jwt-token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "author_wallet": "0x1234...",
  "content": "Check out this amazing photo!",
  "media_cids": ["bafybeig..."],
  "tags": ["photo", "nature"]
}
```

## Example Workflow (JavaScript/TypeScript)

```javascript
// Step 1: Upload image
const uploadImage = async (file, token) => {
  const formData = new FormData();
  formData.append('file', file);
  
  const response = await fetch('/api/posts/upload-image', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`
    },
    body: formData
  });
  
  return await response.json();
};

// Step 2: Create post with image
const createPostWithImage = async (content, imageCid, walletAddress, token) => {
  const response = await fetch('/api/posts', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      author_wallet: walletAddress,
      content: content,
      media_cids: [imageCid],
      tags: []
    })
  });
  
  return await response.json();
};

// Complete workflow
const handleImagePost = async (imageFile, postText, walletAddress, token) => {
  try {
    // Upload image first
    const { cid, url } = await uploadImage(imageFile, token);
    console.log(`Image uploaded: ${url}`);
    
    // Create post with the image CID
    const result = await createPostWithImage(postText, cid, walletAddress, token);
    console.log('Post created:', result);
    
    return result;
  } catch (error) {
    console.error('Error creating post with image:', error);
    throw error;
  }
};
```

## Example Workflow (Python)

```python
import requests

def upload_image(file_path: str, token: str) -> dict:
    """Upload an image and get its CID"""
    with open(file_path, 'rb') as f:
        files = {'file': f}
        headers = {'Authorization': f'Bearer {token}'}
        
        response = requests.post(
            'http://localhost:8000/api/posts/upload-image',
            headers=headers,
            files=files
        )
        
    return response.json()

def create_post_with_image(content: str, image_cid: str, wallet_address: str, token: str) -> dict:
    """Create a post with an image"""
    headers = {
        'Authorization': f'Bearer {token}',
        'Content-Type': 'application/json'
    }
    
    data = {
        'author_wallet': wallet_address,
        'content': content,
        'media_cids': [image_cid],
        'tags': []
    }
    
    response = requests.post(
        'http://localhost:8000/api/posts',
        headers=headers,
        json=data
    )
    
    return response.json()

# Usage example
token = "your-jwt-token"
wallet = "0x1234..."

# Upload image
result = upload_image('photo.jpg', token)
print(f"Image CID: {result['cid']}")
print(f"Image URL: {result['url']}")

# Create post with image
post = create_post_with_image(
    content="Beautiful sunset!",
    image_cid=result['cid'],
    wallet_address=wallet,
    token=token
)
print(f"Post created: {post}")
```

## Multiple Images

You can attach multiple images to a single post by uploading each image separately and including all CIDs:

```json
{
  "author_wallet": "0x1234...",
  "content": "My photo gallery",
  "media_cids": ["bafybeig1...", "bafybeig2...", "bafybeig3..."],
  "tags": ["gallery"]
}
```

## Notes

- Images are stored permanently on IPFS
- Supported formats: JPG, JPEG, PNG, GIF, WebP
- Maximum file size: 10MB per image
- Images are accessible via IPFS gateways
- The `media_cids` field can contain multiple image CIDs
