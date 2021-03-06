var definition = {
	_id: {
		type: 'String'
	},
	_v: {
		type: 'Number'
	},
	_expireAt: {
		type: 'Date'
	},
	serviceId: {
		type: 'String',
		required: true
	},
	app: {
		type: 'String'
	},
	documentId: {
		type: 'String'
	},
	operation: {
		type: 'String',
		required: true
	},
	viewField: {
		type: 'String'
	},
	requestedBy: {
		type: 'String',
		required: true
	},
	respondedBy: {
		type: 'String'
	},
	comments: {
		type: 'String'
	},
	audit: [
		{
			by: {
				type: 'String',
				required: true
			},
			id: {
				type: 'String'
			},
			action: {
				type: 'String',
				required: true,
			},
			remarks: {
				type: 'String'
			},
			timestamp: {
				type: 'Date'
			},
			attachments: [
				{
					filename: {
						type: 'String'
					},
					contentType: {
						type: 'String'
					},
					length: {
						type: 'Number'
					},
					chunkSize: {
						type: 'Number'
					},
					uploadDate: {
						type: 'Date'
					},
					md5: {
						type: 'String'
					},
					href: {
						type: 'String'
					},
					metadata: {
						filename: {
							type: 'String'
						}
					}
				}
			]
		}
	],
	approvers: ['String'],
	checkerStep: {
		type: 'String',
	},
	status: {
		type: 'String',
		enum: ['Approved', 'Rejected', 'Pending', 'Failed', 'Draft', 'Discarded', 'Rework']
	},
	data: {
		old: {
			type: 'Object'
		},
		new: {
			type: 'Object'
		}
	},
	_metadata: {
		type: {
			version: {
				release: { type: 'Number' }
			}
		}
	}
};
module.exports.definition = definition;