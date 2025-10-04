# 1. Given a floor plan image, pass it to nano banana, which should 
# generate the furniture on top of this floor plan
# 2. The output image of the previous image should be passed into nano
# banana again, and each piece of furniture should be covered in its 
# entirety with a red rectangle
# 3. Use an algorithm that for each red rectangle on the new image, 
# extracts the coordinates of the top left corner, and the dimensions
# of it, and crops that rectangle of the image out
# 4. Pass the cropped portion of the image to gpt 4 which will categorize
# the image as one of 5 types of furniture
# 5. For each object, return the coordinates, dimensions, and type for 
# the object