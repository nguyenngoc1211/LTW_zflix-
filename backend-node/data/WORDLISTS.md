# Toxic comment wordlists

- `vietnamese-offensive-words.txt`
  - Source: https://github.com/blue-eyes-vn/vietnamese-offensive-words/blob/main/vn_offensive_words.txt
- `profane-words.json`
  - Source: https://github.com/zautumnz/profane-words/blob/master/words.json

The runtime loads both files from `backend-node/src/modules/community/toxic-comment.filter.js`.
Update the source files directly when refreshing a wordlist.
