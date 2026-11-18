# One price table, in the code, for every session

The cost of a segment is its tokens at the Anthropic API list prices, in euros (product brief). The price table holds, per model, the dollar price per million tokens of input, output, cache writes, and cache reads, and one fixed dollar-to-euro rate, with the date each was read. It lives in the code. A price change, or a new model, is a commit.

Every session is priced with the current table, not with the price on the day it ran. So the same work always has the same cost, and the averages on the Craft versions page compare work, not price changes.

A model that is not in the table has no price. Its tokens are left out of the cost, and the page says that some cost is missing, so a new model is never priced at zero without notice.

The monthly price of the owner's Max plan, for the Max share, is a setting with a default of Max 100.
