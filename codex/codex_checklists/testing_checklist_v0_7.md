# Test Checklist (Manual) - v0_7 (Delta)

Only validate the changes introduced in v0_7 (Inventory + Blueprint flow + Wall switch).

---

Task 1: Inventory page access
- do this/task: Confirm Inventory page loads when signed in
- how to do it: Sign in, visit /inventory
- expected outcome: Inventory library loads with search bar and Create Inventory button
- feedback: yep

Task 2: Create Inventory (basic)
- do this/task: Create a new inventory with prompts + tags
- how to do it: /inventory/create -> fill Title, prompts, add at least 1 tag -> Create Inventory
- expected outcome: Redirects to /inventory/:id and shows title + categories preview
- feedback: yep

Task 3: Inventory search by tag
- do this/task: Find inventory using a tag
- how to do it: On /inventory, type a tag slug (e.g., skincare)
- expected outcome: Top-rated inventory for that tag appears
- feedback: yep

Task 4: Inventory search by title
- do this/task: Find inventory using title keywords
- how to do it: On /inventory, search part of a title
- expected outcome: Matching inventory appears
- feedback: yep

Task 5: Inventory like
- do this/task: Like/unlike an inventory
- how to do it: On /inventory list or detail, click heart
- expected outcome: Likes count updates and icon toggles
- feedback: yep

Task 6: Build Blueprint from inventory
- do this/task: Create a blueprint from an inventory
- how to do it: /inventory/:id/build -> select items -> add mix notes -> add tags
- expected outcome: Blueprint builder allows selection and publish
- feedback: 

Task 7: LLM review generation
- do this/task: Generate a blueprint review
- how to do it: In builder, click Generate Review after selecting items
- expected outcome: Review streams into the text area
- feedback:

Task 8: Publish Blueprint
- do this/task: Publish blueprint from builder
- how to do it: Add at least 1 tag -> Publish Blueprint
- expected outcome: Redirects to /blueprint/:id detail page
- feedback:

Task 9: Blueprint detail page
- do this/task: Validate detail page layout
- how to do it: Open /blueprint/:id
- expected outcome: Shows title, tags, author, selected items, LLM review, comments
- feedback:

Task 10: Blueprint comments
- do this/task: Post a comment on a blueprint
- how to do it: On /blueprint/:id, enter comment -> Post Comment
- expected outcome: Comment appears in list
- feedback:

Task 11: Remix blueprint
- do this/task: Remix a blueprint
- how to do it: On /blueprint/:id, click Remix Blueprint
- expected outcome: Builder opens with prefilled items and review prompt
- feedback:

Task 12: Wall uses blueprints
- do this/task: Validate Wall shows blueprints (not wall_posts)
- how to do it: Go to /wall
- expected outcome: Cards show Blueprint label, link to /blueprint/:id
- feedback:

Task 13: Wall tabs
- do this/task: Verify Wall tabs are For You / Latest / Trending
- how to do it: On /wall, switch tabs
- expected outcome: Only those 3 tabs appear; no Saved tab
- feedback:

Task 14: Wall For You requires followed tags
- do this/task: Validate For You feed behavior
- how to do it: Unfollow all tags -> go to For You
- expected outcome: Empty state prompts to follow tags
- feedback:

---

Notes:
- Fill feedback with pass/fail + short notes.
- If something fails, include steps to reproduce.
