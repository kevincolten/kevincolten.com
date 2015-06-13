Backbone.PostCollection = Backbone.Collection.extend({
	url: "https://raw.githubusercontent.com/mistakevin/mistakevin.github.io/master/posts.json"
})
var posts = new Backbone.PostCollection();
posts.fetch({
	success: function(collection) {
		console.log(collection);
	}
});
