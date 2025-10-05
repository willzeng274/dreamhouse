"""
Centralized prompts for all AI services in the backend.

This file contains all system and user prompts used across the application,
organized by service and functionality for easy maintenance and updates.
"""

# ============================================================================
# IMAGE GENERATION SERVICE
# File: app/services/image_generation_service.py
# ============================================================================

# Method: generate_floorplan (line 8-11)
# Purpose: Convert a hand-drawn sketch into a top-down architectural floorplan
FLOORPLAN_GENERATION_PROMPT = """convert this very rough sketch into a fully realized, top-down floorplan, with proper graphics, lots of distinct furniture, architecture, rooms, etc. make sure that the final output is a proper, real floorplan. Never overlap pieces of furniture, ex. absolutely NO RUGS OR CARPET. NO TEXT OR LABELS. If there is text in the sketch, remove it. everything should be low res black and white. Use only straight lines. Beds should be a uniform light color, not easily mistaken as 2 parts"""

# Method: revise_floorplan (line 13-16)
# Purpose: Revise an existing floorplan based on user instructions
# Note: This is a template that takes an instruction parameter


def get_floorplan_revision_prompt(instruction: str) -> str:
    """
    Generate a prompt for revising a floorplan.

    Args:
        instruction: User's revision instructions

    Returns:
        Formatted prompt for floorplan revision
    """

    full_prompt = f"""
    Edit this image according to the following instructions: {instruction}

    Your edits should be based off of the green annotation. Remove the green annotation at the end.
    Add/remove black straight lines for walls.

    Remember to edit and move around the furniture, fixtures, architectural elements, etc. accordingly! make sure the output is a proper floor plan and does NOT have any annotation remaining on it.
    """

    return full_prompt


# Method: generate_photorealistic (line 18-21)
# Purpose: Generate a photorealistic rendering from a floorplan
PHOTOREALISTIC_GENERATION_PROMPT = (
    "Generate a photorealistic top-down interior image from this floorplan"
)

# Method: generate_realistic_floorplan_for_classification
# Purpose: Generate a realistic top-down rendered version while maintaining exact dimensions/positions
REALISTIC_FLOORPLAN_FOR_CLASSIFICATION_PROMPT = """make realistic top down fully rendered version of this floor plan, keep the dimensions/positions/sizes of all furniture and walls 1 to 1, pixel to pixel"""


# ============================================================================
# AI SERVICE (Generic)
# File: app/services/ai_service.py
# ============================================================================
# Note: This service accepts dynamic prompts from API calls and doesn't use
# hardcoded prompts. All prompts are passed in via the API endpoints.


# ============================================================================
# FUTURE PROMPTS
# ============================================================================
# Add new prompts below as the application grows, following the same format:
# - Service/file location
# - Method name and line numbers
# - Purpose description
# - The actual prompt or prompt template function
