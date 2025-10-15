# About trying to find even better URL UX

comx.cc allows going from any `.com` non-subdomain to our website by appending just 4 characters after `.com`: `x.cc`. On top of that, the .cc TLd is unique as it's 2x the same letter, which makes it much easier for people to type.

Example: google.com/?q=something -> google.comx.cc/?q=something

This is cool since it's just 4 letters, the only problem is this trick wouldn't work for any website: only 44% of all domains use the .com TLD (the % of traffic is probably much larger though, but still)

The advantage to appending after the TLD and before the pathname, rather than prepending any domain with another domain, such as I did with https://llmtext.com/URL, would be that we keep the exact same structure in the pathname, giving us the ability to potentially host original code there without changing, however, this hasn't been a need for me yet.

It's much more interesting to make it work for any domain I guess, so I'm not buying it yet for now, but let's keep this in mind. If I would find a very short, very easy to type domain that can be prepended, maybe that's also nice. `llmtext.com/` requires prepending 12 characters, whereas `ppop.cc/` requires just prepending 8 characters where 3 are the same.

Is this true? Let's try this by typing it a couple times and see how often I can type it with 10 fingers within 20 seconds:

- llmtext.com/: 11x
- ppop.cc/: 8x

Strangely enough, this doesn't hold true with 10 fingers. It probably has to do with my muscle memory and the ability to type common patterns/words more quickly. Thus for experienced typers, a known word and tld is likely better UX. Less experienced typists that type slower and with less fingers (2 or 1) would maybe prefer ppop.cc, but that's not my target audience.

Furthermore, I should take into account the total time of navigating, not just typing part. You also have to click the URL, click again in the right location, and press enter after typing. These are 3 additional actions that take some time, that make the actual domain length weigh less in contrast.

URL UX is an interesting topic that I haven't read much about. I feel like short URL changes are especially easy to remember, which is another important factor that should be taken into account. This is one of the reasons that uithub.com is such a success I think.
