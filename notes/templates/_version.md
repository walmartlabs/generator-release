
[Commits](https://github.com/<%= repoName %>/compare/<%= version %>...master)

## <%= version %> - <%= date %>
<%
_.each(pulls, function(issue) { %>
- [#<%= issue.number %>](<%= issue.html_url %>) - <%= issue.title %> ([@<%= issue.user.login %>](<%= issue.user.url %>))<%
}); 
_.each(issues, function(issue) { %>
- [#<%= issue.number %>](<%= issue.html_url %>) - <%= issue.title %><%
});

// Whitespace hack to get everything to line up nicely with empty lists
if ((issues.length || pulls.length) && commits.length) { %>
<%
}
_.each(commits, function(commit) { %>
- <%= commit.title %> - <%= commit.sha %><%
}); %>

Compatibility notes:
- TODO : What might have broken?
